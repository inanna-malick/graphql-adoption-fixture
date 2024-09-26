package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	_ "modernc.org/sqlite"
)

type Customer struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	Email               string `json:"email"`
	Tier                string `json:"tier"`
	ShipstreamAccountID string `json:"shipstream_account_id"`
	CreatedAt           string `json:"created_at"`
}

type server struct {
	db        *sql.DB
	ordersURL string
	secret    []byte
}

func main() {
	port := env("PORT", "8003")
	dbPath := env("CUSTOMERS_DB", "/app/data/customers.db")
	seedDir := env("SEED_DATA_DIR", "/seed")
	schemaPath := env("SCHEMA_PATH", "/app/schema.sql")

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := applySchema(db, schemaPath); err != nil {
		log.Fatal(err)
	}
	if err := seed(db, seedDir); err != nil {
		log.Fatal(err)
	}

	s := &server{
		db:        db,
		ordersURL: env("ORDERS_URL", "http://orders:8001"),
		secret:    []byte(os.Getenv("MERIDIAN_JWT_SECRET")),
	}

	mux := http.NewServeMux()
	s.registerRoutes(mux)

	log.Printf("customers listening on %s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func applySchema(db *sql.DB, path string) error {
	schema, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	_, err = db.Exec(string(schema))
	return err
}

func seed(db *sql.DB, seedDir string) error {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM customers").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	raw, err := os.ReadFile(filepath.Join(seedDir, "customers.json"))
	if err != nil {
		return err
	}

	var customers []Customer
	if err := json.Unmarshal(raw, &customers); err != nil {
		return err
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	for _, c := range customers {
		_, err := tx.Exec(
			`INSERT INTO customers (id, name, email, tier, shipstream_account_id, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			c.ID, c.Name, c.Email, c.Tier, c.ShipstreamAccountID, c.CreatedAt,
		)
		if err != nil {
			tx.Rollback()
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	log.Printf("seeded %d customers", len(customers))
	return nil
}

func (s *server) authorize(r *http.Request) bool {
	scheme, token, found := strings.Cut(r.Header.Get("Authorization"), " ")
	if !found || scheme != "Bearer" || token == "" {
		return false
	}

	parsed, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		return s.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))

	return err == nil && parsed.Valid
}

func writeJSON(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}
