package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
)

const defaultCSVPath = "assets/csv/transactions.csv"

const (
	resultsPath     = "tmp/jev-results.json"
	correctionsPath = "assets/jev/corrections.json"
)

func main() {
	path := defaultCSVPath
	if len(os.Args) > 1 {
		path = os.Args[1]
	}

	ctx := context.Background()

	var err error
	switch path {
	case "categorise":
		csvPath := defaultCSVPath
		if len(os.Args) > 2 {
			csvPath = os.Args[2]
		}
		err = runCategorise(ctx, csvPath)
	case "review":
		threshold := defaultReviewThreshold
		list := false
		for _, arg := range os.Args[2:] {
			if arg == "--list" {
				list = true
				continue
			}
			if threshold, err = strconv.ParseFloat(arg, 64); err != nil {
				err = fmt.Errorf("threshold %q: %w", arg, err)
				break
			}
		}
		if err == nil {
			err = runReview(ctx, threshold, list)
		}
	case "help", "-h", "--help":
		usage()
		return
	default:
		usage()
		return
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Print(os.Stderr, `expenny - statement classifier

usage:
	cli                          	parse the default statement and print its rows
	cli <csv>                    	parse a statement CSV and print its rows
	cli categorise [csv]         	classify every row (writes tmp/jev-results.json)
	cli review [threshold]       	review low-confidence rows and save corrections
	cli review [threshold] --list 	list the rows that would be reviewed

arguments:
	csv          					statement file (default assets/csv/transactions.csv)
	threshold    					confidence below which a row is reviewed, 0–1 (default 0.7)

environment:
	JEV_API_KEY    					required by categorise
	DATABASE_URL   					required by categorise and review

examples:
	go run ./cmd/cli categorise assets/csv/march.csv
	go run ./cmd/cli review 0.5
	go run ./cmd/cli review --list
	`)
}
