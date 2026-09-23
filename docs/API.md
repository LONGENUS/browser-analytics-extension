# API Reference

The backend exposes a REST API via FastAPI at `http://localhost:8000`. Interactive documentation is available at `/docs` (Swagger UI) and `/redoc`.

## Endpoints

### 1. Health Check
- **`GET /health`**
- **Response**:
  ```json
  {
    "status": "healthy",
    "version": "1.0.0"
  }
  ```

### 2. Run Page Analysis
- **`POST /analyze`**
- **Request Body**:
  ```json
  {
    "url": "https://www.amazon.in/s?k=headphones",
    "extract_products": true,
    "extract_seo": true
  }
  ```
- **Response**:
  ```json
  {
    "id": 1,
    "url": "https://www.amazon.in/s?k=headphones",
    "title": "Amazon.in : headphones",
    "site_type": "amazon",
    "metrics": {
      "total_products": 24,
      "unique_asins": 24,
      "avg_price": 2499.0,
      "total_brands": 8
    },
    "products": [...],
    "seo": {...},
    "summary": "Found 24 products across 8 brands with an average price of ₹2,499."
  }
  ```

### 3. Export Data
- **`POST /export/{format}`** (`format` can be `csv`, `xlsx`, or `json`)
- **Request Body**: Analysis payload or ID to export.
- **Returns**: File download stream.

### 4. Analysis History
- **`GET /history`**: Returns list of previous analyses with pagination.
- **`GET /history/{id}`**: Returns detailed data for a specific analysis run.
- **`DELETE /history/{id}`**: Removes an analysis entry.
