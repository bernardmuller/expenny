package config

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

var keys = []string{keyClassifierAPI, keyDatabaseURL}

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

type Application struct {
}

func CreateConfig() (Config, error) {
	_ = godotenv.Load()

	if missing := missingEnvs(keys); len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required env vars :s", strings.Join(missing, ", "))
	}

	return Config{
		ClassifierApiKey: keyClassifierAPI,
		DbUrl:            keyDatabaseURL,
	}, nil
}

func CreateApplication(cfg Config) (Application, error) {

	return nil, nil
}
