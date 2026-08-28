#!/usr/bin/env bash
#
# 把 model-catalog-metadata.json 里的模型目录元数据写入 dev 库（models 表）
# ------------------------------------------------------------------
# 前置条件：dev 栈已部署含 description_i18n 等目录元数据列的版本
#          （模型元数据重构，dev 分支），否则脚本会检测到列缺失并退出。
#
# 行为：
#   - 已存在的模型行：更新元数据列 + description（英文兜底）+ description_i18n；
#     JSON 里带 icon 的才更新 icon（用于修正 QWEN 之类的非规范值）
#   - 不存在的模型行：按 vendor 名查 vendors.id 后插入（status=1, sync_official=1）
#   - alias_of 条目复制目标模型的元数据
#   - 全程单事务，出错整体回滚；pricing 内存缓存 1 分钟 TTL 自动刷新
#
# 用法：./apply-model-metadata.sh            # 打印将执行的 SQL 摘要并执行
#       DRY_RUN=1 ./apply-model-metadata.sh  # 只打印 SQL 不执行
# ------------------------------------------------------------------
set -euo pipefail

HOST="${DEV_HOST:-ubuntu@43.161.203.160}"
KEY="${DEV_KEY:-$HOME/.ssh/JHK.pem}"
HERE="$(cd "$(dirname "$0")" && pwd)"
DATA="$HERE/model-catalog-metadata.json"

[ -f "$KEY" ] || { echo "✗ 找不到 SSH 私钥：$KEY"; exit 1; }
[ -f "$DATA" ] || { echo "✗ 找不到数据文件：$DATA"; exit 1; }

SSH=(ssh -i "$KEY" -o ConnectTimeout=10 "$HOST")

# ---------- 前置检查：目录元数据列是否已迁移（DRY_RUN 跳过）----------
if [ "${DRY_RUN:-0}" != "1" ]; then
  COL=$("${SSH[@]}" "sudo -u postgres psql -d new_api -At -c \"SELECT count(*) FROM information_schema.columns WHERE table_name='models' AND column_name='description_i18n'\"")
  if [ "$COL" != "1" ]; then
    echo "✗ dev 库 models 表还没有 description_i18n 列——请先部署含模型元数据重构的 dev 分支，再运行本脚本。"
    exit 1
  fi
fi

# ---------- 生成 SQL ----------
SQL=$(python3 - "$DATA" <<'PYEOF'
import json, sys

data = json.load(open(sys.argv[1]))
models = data['models']

def q(s):
    return "'" + str(s).replace("'", "''") + "'"

# 先解析 alias
resolved = {}
for name, m in models.items():
    if 'alias_of' in m:
        src = dict(models[m['alias_of']])
        resolved[name] = src
    else:
        resolved[name] = m

print("BEGIN;")
for name, m in resolved.items():
    desc_map = m['description']
    en = desc_map['en']
    i18n = json.dumps(desc_map, ensure_ascii=False, separators=(',', ':'))
    vendor = m['vendor']

    # 不存在则插入基础行（vendor 按名字查；查不到 vendor 时该行不会插入，最终摘要能看出缺漏）
    print(f"""INSERT INTO models (model_name, description, icon, vendor_id, status, sync_official, name_rule, created_time, updated_time)
SELECT {q(name)}, '', {q(m.get('icon', ''))}, v.id, 1, 1, 0,
       extract(epoch from now())::bigint, extract(epoch from now())::bigint
FROM vendors v
WHERE v.name = {q(vendor)} AND v.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM models WHERE model_name = {q(name)} AND deleted_at IS NULL);""")

    icon_set = f"icon = {q(m['icon'])}," if m.get('icon') else ""
    print(f"""UPDATE models SET
  description = {q(en)},
  description_i18n = {q(i18n)},
  {icon_set}
  input_modalities = {q(m['input_modalities'])},
  output_modalities = {q(m['output_modalities'])},
  context_length = {int(m['context_length'])},
  max_output_tokens = {int(m['max_output_tokens'])},
  release_date = {q(m['release_date'])},
  knowledge_cutoff = {q(m['knowledge_cutoff'])},
  parameter_count = {q(m['parameter_count'])},
  capabilities = {q(m['capabilities'])},
  updated_time = extract(epoch from now())::bigint
WHERE model_name = {q(name)} AND deleted_at IS NULL;""")

print("COMMIT;")
names = ",".join(q(n) for n in resolved)
print(f"""SELECT m.model_name, v.name AS vendor, m.context_length, m.release_date,
       length(m.description_i18n) AS i18n_len
FROM models m LEFT JOIN vendors v ON v.id = m.vendor_id
WHERE m.deleted_at IS NULL AND m.model_name IN ({names}) ORDER BY v.name, m.model_name;""")
PYEOF
)

echo "共 $(grep -c '^UPDATE models' <<<"$SQL") 个模型待写入"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "$SQL"
  exit 0
fi

echo "$SQL" | "${SSH[@]}" "sudo -u postgres psql -d new_api -v ON_ERROR_STOP=1 -f -"
echo "✓ 元数据已写入。pricing 缓存 1 分钟内自动刷新，可访问 https://dev.fairrouter.ai/pricing 验证。"
