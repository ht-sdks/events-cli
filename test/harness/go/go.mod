module github.com/ht-sdks/events-cli/test/harness/go

go 1.22

require github.com/ht-sdks/events-sdk-go v0.0.2

// Indirect: runtime deps of events-sdk-go (message IDs, retry backoff) plus
// further transitives from its module graph. Recorded by `go mod tidy`.
require (
	github.com/google/uuid v1.6.0 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/rogpeppe/go-internal v1.16.0 // indirect
	github.com/segmentio/backo-go v1.0.1 // indirect
)
