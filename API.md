# API Documentation - Facebook Automation

## Base URL
```
http://localhost:3737
```

## Endpoints

### 1. Add Post to Queue
**POST** `/api/post`

Dodaje post do kolejki.

**Body:**
```json
{
  "row_number": 2,
  "group_link": "https://www.facebook.com/groups/218461347699980",
  "post_copy": "Twoja treść posta\nZ wieloma liniami",
  "group_name": "Nazwa grupy",
  "group_id": 218461347699980,
  "post_language": "PL",
  "job_title": "Software Engineer",
  "job_url": "https://example.com/job",
  "job_company": "Company Name",
  "generated_at": "2025-10-21T09:11:56.179Z",
  "ready_to_publish": true
}
```

**Wymagane pola:**
- `group_link` - URL grupy Facebook
- `post_copy` - Treść posta

**Response:**
```json
{
  "success": true,
  "message": "Post added to queue",
  "queueLength": 5,
  "postId": 1729681200000
}
```

---

### 2. View Queue
**GET** `/api/queue`

Sprawdź zawartość kolejki.

**Response:**
```json
{
  "success": true,
  "queueLength": 3,
  "queue": [
    {
      "id": 1729681200000,
      "groupUrl": "https://www.facebook.com/groups/123",
      "message": "Post content",
      "metadata": {...},
      "status": "pending",
      "addedAt": "2025-10-23T14:00:00.000Z"
    }
  ]
}
```

---

### 3. Check Status
**GET** `/api/status`

Sprawdź status aplikacji.

**Response:**
```json
{
  "success": true,
  "isRunning": false,
  "isPaused": false,
  "queueLength": 3
}
```

---

### 4. Start Processing
**POST** `/api/start`

Uruchom przetwarzanie kolejki.

**Response:**
```json
{
  "success": true,
  "message": "Processing queue started",
  "postsToProcess": 3
}
```

---

### 5. Clear Queue
**DELETE** `/api/queue`

Wyczyść kolejkę.

**Response:**
```json
{
  "success": true,
  "message": "Queue cleared"
}
```

---

## Przykład użycia z n8n

### HTTP Request Node

**Method:** POST  
**URL:** `http://localhost:3737/api/post`  
**Body (JSON):**
```json
{
  "group_link": "{{ $json.group_link }}",
  "post_copy": "{{ $json.post_copy }}",
  "row_number": "{{ $json.row_number }}",
  "group_name": "{{ $json.group_name }}",
  "group_id": "{{ $json.group_id }}",
  "job_title": "{{ $json.job_title }}",
  "job_url": "{{ $json.job_url }}",
  "job_company": "{{ $json.job_company }}"
}
```

### Workflow
1. n8n wysyła posty do `/api/post`
2. Aplikacja dodaje je do kolejki
3. Ręcznie lub automatycznie wywołaj `/api/start`
4. Aplikacja przetworzy wszystkie posty z opóźnieniem 60-90s między każdym

---

## Curl Examples

### Add post:
```bash
curl -X POST http://localhost:3737/api/post \
  -H "Content-Type: application/json" \
  -d '{
    "group_link": "https://www.facebook.com/groups/123",
    "post_copy": "Test post\nLine 2\nLine 3"
  }'
```

### View queue:
```bash
curl http://localhost:3737/api/queue
```

### Start processing:
```bash
curl -X POST http://localhost:3737/api/start
```

### Clear queue:
```bash
curl -X DELETE http://localhost:3737/api/queue
```

---

## Notes

- Server startuje automatycznie z aplikacją na porcie 3737
- Posty są przetwarzane sekwencyjnie z opóźnieniem 60-90s
- Kolejka utrzymuje się tylko gdy aplikacja działa
- Status `pending` → `processing` → `completed` / `failed`
