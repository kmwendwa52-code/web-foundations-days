# Library API Design: Books Resource

This document describes a REST API for a library's **books** resource.

- **Base URL:** `https://api.library.example.com`
- **Format:** all requests and responses use JSON
- **Resource:** `/books` (plural noun, no verbs in the path)

## Book object

A book looks like this:

```json
{
  "id": 7,
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "isbn": "978-0385474542",
  "publishedYear": 1958,
  "available": true
}
```

## Endpoints

### 1. List all books

- **Method:** `GET`
- **Path:** `/books`
- **Description:** Returns an array of every book in the library.
- **Request body:** none
- **Success status:** `200 OK`

### 2. Get one book

- **Method:** `GET`
- **Path:** `/books/{id}`
- **Description:** Returns the single book with the given id.
- **Example path:** `/books/7`
- **Request body:** none
- **Success status:** `200 OK`

### 3. Create a book

- **Method:** `POST`
- **Path:** `/books`
- **Description:** Adds a new book to the library.
- **Example request body:**

  ```json
  {
    "title": "Weep Not, Child",
    "author": "Ngugi wa Thiong'o",
    "isbn": "978-0435908300",
    "publishedYear": 1964
  }
  ```

- **Success status:** `201 Created` (the response contains the new book, including its generated `id`)

### 4. Update a book

- **Method:** `PUT`
- **Path:** `/books/{id}`
- **Description:** Replaces the details of an existing book.
- **Example path:** `/books/7`
- **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "isbn": "978-0385474542",
    "publishedYear": 1958,
    "available": false
  }
  ```

- **Success status:** `200 OK` (the response contains the updated book)

### 5. Delete a book

- **Method:** `DELETE`
- **Path:** `/books/{id}`
- **Description:** Removes the book with the given id from the library.
- **Example path:** `/books/7`
- **Request body:** none
- **Success status:** `204 No Content` (nothing is returned in the response body)

### 6. List books by an author

- **Method:** `GET`
- **Path:** `/books?author={name}`
- **Description:** Returns only the books written by the given author, using a query parameter.
- **Example path:** `/books?author=Chinua%20Achebe`
- **Request body:** none
- **Success status:** `200 OK` (an empty array `[]` if the author has no books)

## Summary table

| Action | Method | Path | Success status |
| --- | --- | --- | --- |
| List all books | GET | `/books` | 200 OK |
| Get one book | GET | `/books/{id}` | 200 OK |
| Create a book | POST | `/books` | 201 Created |
| Update a book | PUT | `/books/{id}` | 200 OK |
| Delete a book | DELETE | `/books/{id}` | 204 No Content |
| List books by author | GET | `/books?author={name}` | 200 OK |

## Error codes

### 400 Bad Request

The request is invalid, so the server cannot process it.

- **Example:** `POST /books` with a body that has no `title`, or where `publishedYear` is the text `"nineteen fifty"` instead of a number.
- **Example response body:**

  ```json
  {
    "error": "Bad Request",
    "message": "The field 'title' is required."
  }
  ```

### 404 Not Found

The resource the client asked for does not exist.

- **Example:** `GET /books/9999` when no book has the id `9999`. The same error applies to `PUT /books/9999` and `DELETE /books/9999`.
- **Example response body:**

  ```json
  {
    "error": "Not Found",
    "message": "No book exists with id 9999."
  }
  ```
