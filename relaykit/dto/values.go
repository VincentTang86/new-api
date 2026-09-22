package dto

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
)

type StringValue string

func (s *StringValue) UnmarshalJSON(data []byte) error {
	var str string
	if err := json.Unmarshal(data, &str); err == nil {
		*s = StringValue(str)
		return nil
	}

	var raw json.Number
	if err := json.Unmarshal(data, &raw); err == nil {
		*s = StringValue(raw.String())
		return nil
	}

	return json.Unmarshal(data, &str)
}

func (s StringValue) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(s))
}

// IntValue is an integer that tolerates the number spellings providers actually
// emit: a plain integer, a float that is an integer in disguise (DashScope's
// dedicated instances serialise seconds as 5.0 while the public endpoint sends
// 5), or either of those quoted as a string. Fractional values round to the
// nearest integer; NaN, ±Inf and magnitudes beyond int64 are rejected.
type IntValue int

func (i *IntValue) UnmarshalJSON(b []byte) error {
	var n int
	if err := json.Unmarshal(b, &n); err == nil {
		*i = IntValue(n)
		return nil
	}
	var num json.Number
	if err := json.Unmarshal(b, &num); err == nil {
		return i.setFromNumber(num)
	}
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return fmt.Errorf("dto: cannot parse %s as an integer", string(b))
	}
	if v, err := strconv.Atoi(s); err == nil {
		*i = IntValue(v)
		return nil
	}
	return i.setFromNumber(json.Number(s))
}

// setFromNumber handles the decimal literals strconv.Atoi rejects, i.e. anything
// with a fraction or exponent.
func (i *IntValue) setFromNumber(num json.Number) error {
	f, err := num.Float64()
	if err != nil {
		return fmt.Errorf("dto: cannot parse %q as an integer: %w", num, err)
	}
	if math.IsNaN(f) || math.IsInf(f, 0) || f >= math.MaxInt64 || f <= math.MinInt64 {
		return fmt.Errorf("dto: %q is out of range for an integer", num)
	}
	*i = IntValue(int64(math.Round(f)))
	return nil
}

func (i IntValue) MarshalJSON() ([]byte, error) {
	return json.Marshal(int(i))
}

type BoolValue bool

func (b *BoolValue) UnmarshalJSON(data []byte) error {
	var boolean bool
	if err := json.Unmarshal(data, &boolean); err == nil {
		*b = BoolValue(boolean)
		return nil
	}
	var str string
	if err := json.Unmarshal(data, &str); err != nil {
		return err
	}
	if str == "true" {
		*b = BoolValue(true)
	} else if str == "false" {
		*b = BoolValue(false)
	} else {
		return json.Unmarshal(data, &boolean)
	}
	return nil
}
func (b BoolValue) MarshalJSON() ([]byte, error) {
	return json.Marshal(bool(b))
}
