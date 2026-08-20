package analytics

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
)

func mockServer() (chan []byte, *httptest.Server) {
	done := make(chan []byte, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := bytes.NewBuffer(nil)
		_, _ = io.Copy(buf, r.Body)
		done <- buf.Bytes()
	}))
	return done, server
}

type batchPayload struct {
	Batch []map[string]interface{} `json:"batch"`
}

func decodeBatch(raw []byte) batchPayload {
	var payload batchPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		panic(err)
	}
	return payload
}
