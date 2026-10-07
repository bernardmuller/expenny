include .env

db_migrate_up:
	@echo "Migrating up..."
	@cd ./internal/store/postgres/schema &&	goose postgres ${POSTGRES_URI} up

db_migrate_down:
	@echo "Migrating down..."
	@cd ./internal/store/postgres/schema &&	goose postgres ${POSTGRES_URI} down

db_generate_queries:
	@echo "Generating queries..."
	@sqlc generate

.PHONY: help
help: ## print make targets 
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: get-install-tailwindcss
get-install-tailwindcss: ## Installs the tailwindcss cli
	curl -sLO https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64
	chmod +x tailwindcss-linux-x64
	mv tailwindcss-linux-x64 tailwindcss

.PHONY: tailwind-watch
tailwind-watch: ## compile tailwindcss and watch for changes
	./tailwindcss -i ./static/css/globals.css -o ./static/css/style.css --watch

.PHONY: tailwind-build
tailwind-build: ## one-time compile tailwindcss styles
	./tailwindcss -i ./static/css/globals.css -o ./static/css/style.css

.PHONY: categorise
categorise: ## classify the statement csv with jev
	go run ./internal/scripts categorise

.PHONY: review
review: ## correct the low-confidence rows of the last classification
	go run ./internal/scripts review

.PHONY: build
build: ## build the Go bot binary
	go build -o ./tmp/bot ./cmd/bot/main.go

.PHONY: watch
watch: ## build and watch the project with air
	go build -o ./tmp/bot ./cmd/bot/main.go && air

build_mcp_binary:
	@mkdir -p dist
	@env GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -ldflags="-s -w" -o ./dist/bootstrap ./cmd/mcp/main.go

