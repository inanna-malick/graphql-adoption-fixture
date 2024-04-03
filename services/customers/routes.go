package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
)

func (s *server) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /customers", s.guard(s.handleListCustomers))
	mux.HandleFunc("GET /customers/{id}", s.guard(s.handleGetCustomer))
	mux.HandleFunc("GET /customers/{id}/orders", s.guard(s.handleCustomerOrders))
}

func (s *server) guard(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.authorize(r) {
			writeError(w, http.StatusUnauthorized, "unauthorized", "missing or invalid bearer token")
			return
		}
		next(w, r)
	}
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "customers"})
}

func (s *server) handleListCustomers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(
		`SELECT id, name, email, tier, created_at
		 FROM customers ORDER BY id`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}
	defer rows.Close()

	customers := []Customer{}
	for rows.Next() {
		var c Customer
		if err := rows.Scan(&c.ID, &c.Name, &c.Email, &c.Tier, &c.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}
		customers = append(customers, c)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":  customers,
		"total": len(customers),
	})
}

func (s *server) lookup(id string) (*Customer, error) {
	var c Customer
	err := s.db.QueryRow(
		`SELECT id, name, email, tier, created_at
		 FROM customers WHERE id = ?`, id,
	).Scan(&c.ID, &c.Name, &c.Email, &c.Tier, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *server) handleGetCustomer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	c, err := s.lookup(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "no customer with id "+id)
		return
	}

	writeJSON(w, http.StatusOK, c)
}

// The orders team owns order history; we hold nothing but the customer id, so
// this is a passthrough to their v1 list endpoint filtered by customerRef.
func (s *server) handleCustomerOrders(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if _, err := s.lookup(id); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "no customer with id "+id)
		return
	}

	target := s.ordersURL + "/v1/orders?limit=100&customerRef=" + url.QueryEscape(id)
	req, err := http.NewRequest("GET", target, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}
	req.Header.Set("Authorization", r.Header.Get("Authorization"))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_error", "orders service unreachable")
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_error", err.Error())
		return
	}

	if resp.StatusCode != http.StatusOK {
		writeError(w, http.StatusBadGateway, "upstream_error", "orders returned "+resp.Status)
		return
	}

	var page struct {
		Data  []json.RawMessage `json:"data"`
		Total int               `json:"total"`
	}
	if err := json.Unmarshal(body, &page); err != nil {
		writeError(w, http.StatusBadGateway, "upstream_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"customer_id": id,
		"orders":      page.Data,
		"total":       page.Total,
	})
}
