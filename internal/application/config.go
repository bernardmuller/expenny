package application

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

const (
	keyClassifierAPI       = "CLASSIFIER_API_KEY"
	keyClassifierAPILegacy = "JEV_API_KEY"
	keyClassifierBaseURL   = "CLASSIFIER_BASE_URL"
	keyClassifierModel     = "CLASSIFIER_MODEL"
	keyDatabaseURL         = "DATABASE_URL"
	keyAuthSecret          = "AUTH_SECRET"
)

var keys = []string{keyDatabaseURL, keyAuthSecret}

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
	ClassifierApiKey  string
	ClassifierBaseURL string
	ClassifierModel   string
	DbUrl             string
	AuthSecret        string
}

func CreateConfig() (Config, error) {
	_ = godotenv.Load()

	if missing := missingEnvs(keys); len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required env vars: %s", strings.Join(missing, ", "))
	}

	// The decision API key was once wired under JEV_API_KEY; keep accepting it
	// so existing .env files do not have to be renamed.
	classifierKey := os.Getenv(keyClassifierAPI)
	if classifierKey == "" {
		classifierKey = os.Getenv(keyClassifierAPILegacy)
	}
	if classifierKey == "" {
		return Config{}, fmt.Errorf("missing required env var: %s (or %s)", keyClassifierAPI, keyClassifierAPILegacy)
	}

	return Config{
		ClassifierApiKey:  classifierKey,
		ClassifierBaseURL: os.Getenv(keyClassifierBaseURL),
		ClassifierModel:   os.Getenv(keyClassifierModel),
		DbUrl:             os.Getenv(keyDatabaseURL),
		AuthSecret:        os.Getenv(keyAuthSecret),
	}, nil
}
