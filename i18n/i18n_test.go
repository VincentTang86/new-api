package i18n

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The frontend stores its own camelCase interface codes ("zhCN" / "zhTW") in the
// user language setting, while browsers send BCP-47 tags on Accept-Language.
// Both spellings must land on the same backend locale, otherwise a Traditional
// Chinese user silently receives Simplified copy.
func TestNormalizeLang(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"zhTW", LangZhTW},
		{"zh-TW", LangZhTW},
		{"zh_TW", LangZhTW},
		{"zh-Hant", LangZhTW},
		{"zh-HK", LangZhTW},
		{"zhCN", LangZhCN},
		{"zh-CN", LangZhCN},
		{"zh", LangZhCN},
		{"en", LangEn},
		{"en-US", LangEn},
		{"fr", LangEn},
		{"", LangEn},
	}
	for _, c := range cases {
		assert.Equal(t, c.want, normalizeLang(c.in), "normalizeLang(%q)", c.in)
	}
}

// A key missing from one locale file makes Translate return the raw message id,
// and these particular messages are sent to users as email subjects and bodies.
func TestUserFacingTemplatesRenderInEveryLocale(t *testing.T) {
	require.NoError(t, Init())

	data := map[string]any{
		"SystemName": "FairRouter",
		"Code":       "018b97",
		"Link":       "https://example.test/wallet",
		"Minutes":    10,
		"Title":      "quota is running low",
		"Quota":      "$1.23",
	}
	keys := []string{
		MsgEmailVerificationSubject, MsgEmailVerificationBody,
		MsgEmailPasswordResetSubject, MsgEmailPasswordResetBody,
		MsgNotifyQuotaLowTitle, MsgNotifySubscriptionQuotaLowTitle,
		MsgNotifyQuotaLowBark, MsgNotifyQuotaLowPlain, MsgNotifyQuotaLowHTML,
	}
	for _, lang := range SupportedLanguages() {
		for _, key := range keys {
			got := Translate(lang, key, data)
			assert.NotEqual(t, key, got, "%s/%s fell back to the message id", lang, key)
			assert.NotContains(t, got, "{{", "%s/%s left a template action unrendered", lang, key)
		}
	}
}

// The password reset link carries query parameters. go-i18n renders with
// text/template on purpose; an html/template would escape "&" into "&amp;" and
// hand the user a broken link.
func TestPasswordResetLinkIsNotHTMLEscaped(t *testing.T) {
	require.NoError(t, Init())

	link := "https://example.test/user/reset?email=a@b.c&token=xyz"
	body := Translate(LangEn, MsgEmailPasswordResetBody, map[string]any{
		"SystemName": "FairRouter",
		"Link":       link,
		"Minutes":    10,
	})
	assert.Contains(t, body, link)
	assert.NotContains(t, body, "&amp;")
}
