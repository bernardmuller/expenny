package application

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

const (
	keyClassifierAPI     = "CLASSIFIER_API_KEY"
	keyClassifierBaseURL = "CLASSIFIER_BASE_URL"
	keyClassifierModel   = "CLASSIFIER_MODEL"
	keyDatabaseURL       = "DATABASE_URL"
	keyAuthSecret        = "AUTH_SECRET"
)

var keys = []string{keyClassifierAPI, keyDatabaseURL, keyAuthSecret}

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

	return Config{
		ClassifierApiKey:  os.Getenv(keyClassifierAPI),
		ClassifierBaseURL: os.Getenv(keyClassifierBaseURL),
		ClassifierModel:   os.Getenv(keyClassifierModel),
		DbUrl:             os.Getenv(keyDatabaseURL),
		AuthSecret:        os.Getenv(keyAuthSecret),
	}, nil
}
