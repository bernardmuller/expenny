package application

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

const (
	keyClassifierAPI = "CLASSIFIER_API_KEY"
	keyDatabaseURL   = "DATABASE_URL"
)

// Only DATABASE_URL is required to build an Application. The classifier key is
// used by the CLI (categorise) and may legitimately be absent in processes that
// only ingest statements, such as the MCP server.
var keys = []string{keyDatabaseURL}

func missingEnvs(keys []string) []string {
	var missing []string
	for _, k := range keys {
		if _, ok := os.LookupEnv(k); !ok {
			missing = append(missing, k)
		}
	}
	return missing
}

type Config struct {
	ClassifierApiKey string
	DbUrl            string
}

func CreateConfig() (Config, error) {
	_ = godotenv.Load()

	if missing := missingEnvs(keys); len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required env vars: %s", strings.Join(missing, ", "))
	}

	return Config{
		ClassifierApiKey: os.Getenv(keyClassifierAPI),
		DbUrl:            os.Getenv(keyDatabaseURL),
	}, nil
}
