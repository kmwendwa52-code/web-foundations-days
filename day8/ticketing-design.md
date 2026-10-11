# TicketHub Design

TicketHub is a website that sells tickets for concerts and events. Its hardest moment is the **big sale**, when a very popular concert goes on sale and many more people try to buy than there are seats. This document follows the seven-part design framework:

1. Requirements
2. Estimates
3. API
4. Data model
5. Preventing double-booking
6. Architecture
7. Trade-offs


## 1. Requirements

### Functional requirements

- Users can **register and log in**.
- Users can **browse and search events** by city, date or name.
- Users can **view an event's seat map** and see which seats are available, held or sold.
- Users can **hold seats** for a short time (5 minutes) while they pay.
- Users can **pay** for the held seats and receive their **tickets**.
- Users can **view their tickets** later and receive them by email.
- When a very popular event goes on sale, users wait in an **orderly queue** instead of crashing the site.

### Non-functional requirements

- **Speed:** browsing pages answer in under 500 ms, and seat holds answer in under 1 second, even during the big sale.
- **Correctness:** a seat is **never sold to two people**, nobody is charged for a seat they did not get, and a paid order is never lost. This matters more than speed for the buying steps.
- **Fairness:** buyers are served fairly, a fast internet connection or a bot gets no big advantage, and one person cannot buy up all the seats (limit of 4 tickets per person per event). People in the queue can see their position.
- **Availability:** at least 99.9% uptime, and the site stays up during a big sale.
- **Scalability:** it handles 2 million registered users and a sudden surge of 200,000 people within 10 minutes.
- **Consistency:** seat information used for buying is always exact (strong consistency). Browsing information may be a few seconds old (eventual consistency).
- **Security:** all traffic uses HTTPS and passwords are hashed. Card details go straight to the payment provider and are never stored by TicketHub.
- **Durability:** orders and tickets are stored safely with backups and replication.

## 2. Estimates

### Assumptions

- **2,000,000** registered users.
- **Normal day:** 50,000 people visit, each viewing 10 pages, and 5,000 tickets are sold.
- **Big sale:** 200,000 people try to buy 20,000 seats within the first 10 minutes (600 seconds).
- During the big sale, each person sends about **10 requests** (opening the event page, loading the seat map a few times, holding seats, paying).
- There are **86,400 seconds** in a day.
- On a normal day, **peak traffic is 5 times the average**. During the big sale, the busiest moments are **3 times the 10-minute average**.

### Normal day

- Page views per day: 50,000 × 10 = **500,000**
- Average page views per second: 500,000 ÷ 86,400 ≈ **5.8 per second**
- Peak page views per second: 5.8 × 5 ≈ **29 per second**
- Ticket purchases: 5,000 ÷ 86,400 ≈ **0.06 per second** on average (about one every 17 seconds), and about **0.3 per second** at peak
- Reads (page views) outnumber writes (purchases) about **100 to 1**.

### Big sale (first 10 minutes)

- People arriving: 200,000 ÷ 600 ≈ **333 per second**
- Requests: 200,000 × 10 = 2,000,000 in 10 minutes, so about **3,333 requests per second** on average and about **10,000 per second** at the busiest moments
- Seat hold attempts: 200,000 ÷ 600 ≈ **333 per second** on average, about **1,000 per second** at the busiest moments
- Ticket sales: if all 20,000 seats sell within the 10 minutes, that is up to **33 sales per second**
- Competition: 200,000 people for 20,000 seats is **10 people for every seat**, so **180,000 people (90%) will not get a ticket**.

### Comparison

| Measure | Normal day (average) | Normal day (peak) | Big sale (average) | Big sale (busiest moments) |
| --- | --- | --- | --- | --- |
| Requests per second | 5.8 | 29 | 3,333 | 10,000 |
| Purchases per second | 0.06 | 0.3 | up to 33 | up to 33 |

The big sale's average request rate is about **115 times** the normal-day peak and **576 times** the normal-day average, and it all arrives in 10 minutes. Purchases per second also rise 576 times. The nature of the load changes too: on a normal day the system is read-heavy, but during the big sale thousands of people compete to **write** to the same 20,000 seat rows. This is why the design needs a waiting room, caching for reads, and a very careful way of holding seats.

## 3. API

### Conventions

- **Base URL:** `https://api.tickethub.example.com/v1`
- **Format:** JSON, with the header `Authorization: Bearer <token>` on every endpoint except login.
- **Money:** amounts are in cents, as whole numbers (for example `5000` means 50.00).
- **Dates:** ISO 8601 in UTC.

### Endpoints

| Method | Path | Description | Success status |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | Log in with email and password and get a token | `200 OK` |
| `GET` | `/events` | Browse and search events (`city`, `date`, `q`, `page`, `limit`) | `200 OK` |
| `GET` | `/events/{id}` | Get the details of one event | `200 OK` |
| `GET` | `/events/{id}/seats` | View the seat map with the status of each seat | `200 OK` |
| `POST` | `/events/{id}/queue` | Join the waiting room for a big sale | `202 Accepted` |
| `GET` | `/events/{id}/queue` | Check your place in the waiting room, and get your admission pass when it is your turn | `200 OK` |
| `POST` | `/events/{id}/holds` | Hold one or more seats for 5 minutes | `201 Created` |
| `DELETE` | `/holds/{id}` | Release a hold you no longer want | `204 No Content` |
| `POST` | `/orders` | Pay for a hold and receive the tickets | `201 Created` |
| `GET` | `/me/tickets` | View your tickets | `200 OK` |

During a big sale, `POST /events/{id}/holds` and `POST /orders` also need the **admission pass** from the waiting room, sent in the header `X-Admission-Pass`.

### Example: hold seats

**Request:** `POST /v1/events/42/holds`

```json
{
  "seatIds": [1801, 1802]
}
```

**Response: `201 Created`**

```json
{
  "holdId": "h_9f3a",
  "eventId": 42,
  "seatIds": [1801, 1802],
  "totalCents": 10000,
  "expiresAt": "2026-10-20T10:05:00Z"
}
```

### Example: seat already taken

**Response: `409 Conflict`** (the whole request fails, and no seat is held)

```json
{
  "error": {
    "status": 409,
    "code": "SEAT_UNAVAILABLE",
    "message": "Seat 1802 was just taken. Please choose another seat.",
    "details": [{ "seatId": 1802 }]
  }
}
```

### Example: pay for a hold

**Request:** `POST /v1/orders` (with the header `Idempotency-Key: 7c1e...` so a retried request cannot charge twice)

```json
{
  "holdId": "h_9f3a",
  "paymentToken": "tok_visa_123"
}
```

**Response: `201 Created`**

```json
{
  "orderId": 5501,
  "status": "paid",
  "totalCents": 10000,
  "tickets": [
    { "code": "TH-8K2Q-0001", "seatId": 1801, "section": "A", "row": "1", "seat": 1 },
    { "code": "TH-8K2Q-0002", "seatId": 1802, "section": "A", "row": "1", "seat": 2 }
  ]
}
```

### Error codes

| Status | When it happens |
| --- | --- |
| `400` | The request is invalid, for example no seats chosen, or more than 4 seats. |
| `401` | The token is missing or has expired. |
| `402` | The payment was declined. The hold stays until it expires, so the user can try another card. |
| `403` | The user tries to hold seats without an admission pass, or tries to use someone else's hold. |
| `404` | The event, seat or hold does not exist. |
| `409` | A requested seat is already held or sold by someone else. |
| `410` | The hold has expired. |
| `429` | Too many requests from one user or address. |
| `503` | The system is overloaded, so the user is sent to the waiting room. |

## 4. Data model

### Tables

- **users:** one row per registered user.
- **events:** one row per concert or event, with its venue, start time and on-sale time.
- **seats:** one row for every seat of every event, with its price and its **status** (`available`, `held` or `sold`). A held seat also stores who holds it and when the hold ends.
- **orders:** one row for every completed payment, linked to the user who paid. The unique `payment_ref` makes sure one payment can only create one order.
- **tickets:** one row for every ticket, linking an order to a seat. The unique `seat_id` makes sure a seat can only ever be on one ticket.

### Relationships

```
users  1 ----< orders        (one user makes many orders)
events 1 ----< seats         (one event has many seats)
events 1 ----< orders        (one event has many orders)
orders 1 ----< tickets       (one order contains many tickets)
seats  1 ---- 0..1 tickets   (a seat is on at most ONE ticket)
users  1 ----< seats         (a user may currently hold many seats, through held_by)
```

- **One-to-many:** a user has many orders, an event has many seats, and an order has many tickets. Each of these is stored with a foreign key on the "many" side.
- **One-to-at-most-one:** a seat can appear on only one ticket. The `UNIQUE` constraint on `tickets.seat_id` enforces this in the database.
- **Orders and seats are linked through tickets.** An order can contain several seats, but a seat belongs to one order, so `tickets` holds one row for each seat sold.

### CREATE TABLE statements

The SQL below uses SQLite syntax and was tested. In PostgreSQL, `datetime('now')` becomes `now()` and `datetime('now', '+5 minutes')` becomes `now() + interval '5 minutes'`.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  venue      TEXT NOT NULL,
  starts_at  TEXT NOT NULL,
  on_sale_at TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'upcoming'
             CHECK (status IN ('upcoming', 'on_sale', 'sold_out', 'finished'))
);

CREATE TABLE seats (
  id              INTEGER PRIMARY KEY,
  event_id        INTEGER NOT NULL,
  section         TEXT NOT NULL,
  row_label       TEXT NOT NULL,
  seat_number     INTEGER NOT NULL,
  price_cents     INTEGER NOT NULL CHECK (price_cents > 0),
  status          TEXT NOT NULL DEFAULT 'available'
                  CHECK (status IN ('available', 'held', 'sold')),
  held_by         INTEGER,
  hold_expires_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events (id),
  FOREIGN KEY (held_by)  REFERENCES users (id),
  UNIQUE (event_id, section, row_label, seat_number),
  -- A seat has hold details if and only if it is held
  CHECK (
    (status = 'held' AND held_by IS NOT NULL AND hold_expires_at IS NOT NULL)
    OR
    (status <> 'held' AND held_by IS NULL AND hold_expires_at IS NULL)
  )
);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  event_id    INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded')),
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  payment_ref TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES users (id),
  FOREIGN KEY (event_id) REFERENCES events (id)
);

CREATE TABLE tickets (
  id       INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  seat_id  INTEGER NOT NULL UNIQUE,   -- a seat can appear on only ONE ticket, ever
  code     TEXT NOT NULL UNIQUE,
  FOREIGN KEY (order_id) REFERENCES orders (id),
  FOREIGN KEY (seat_id)  REFERENCES seats (id)
);

CREATE INDEX idx_seats_event_status ON seats (event_id, status);
CREATE INDEX idx_orders_user        ON orders (user_id, created_at DESC);
CREATE INDEX idx_tickets_order      ON tickets (order_id);
```

### Indexes

- **`idx_seats_event_status` on `seats (event_id, status)`:** the seat map and "how many seats are left?" both look up the seats of one event, so this index finds them without reading the seats of every event.
- **`idx_orders_user` on `orders (user_id, created_at DESC)`:** "view my tickets" needs one user's newest orders first.
- **`idx_tickets_order` on `tickets (order_id)`:** it finds the tickets of an order quickly.

### Example queries

**Seat map for an event** (an expired hold is shown as available):

```sql
SELECT id, section, row_label, seat_number, price_cents,
       CASE WHEN status = 'held' AND hold_expires_at < datetime('now')
            THEN 'available' ELSE status END AS status
FROM seats
WHERE event_id = 42
ORDER BY section, row_label, seat_number;
```

**A user's tickets:**

```sql
SELECT tickets.code, events.name, seats.section, seats.row_label, seats.seat_number
FROM orders
JOIN tickets ON tickets.order_id = orders.id
JOIN seats   ON seats.id = tickets.seat_id
JOIN events  ON events.id = orders.event_id
WHERE orders.user_id = 7
ORDER BY orders.created_at DESC;
```

## 5. Preventing double-booking

**The rule:** a seat can be sold to only one person. If this rule breaks, two people arrive at the venue with a ticket for the same seat. The rule is enforced by the **database**, in several layers, so it still holds when many app servers handle requests at the same moment.

### The wrong way (and why it fails)

```
1. SELECT status FROM seats WHERE id = 1802;   -- "available"
2. (the app decides the seat is free)
3. UPDATE seats SET status = 'held' ... WHERE id = 1802;
```

If Ann and Ben both run step 1 at the same moment, both see "available", and both then run step 3. This is a **race condition**, and both would get the seat.

### The right way: one atomic conditional update

Checking and changing happen in **one single statement**, so there is no gap between them:

```sql
UPDATE seats
SET status = 'held',
    held_by = :user_id,
    hold_expires_at = datetime('now', '+5 minutes')
WHERE id = :seat_id
  AND (status = 'available'
       OR (status = 'held' AND hold_expires_at < datetime('now')));
```

The app then looks at **how many rows the update changed**:

- **1 row:** this user got the seat.
- **0 rows:** someone else already has it, so the app answers `409 Conflict`.

### What happens when two people click the same seat at the same moment

1. Ann and Ben click seat 1802 at the same instant, and their requests reach two different app servers.
2. Both app servers send the same `UPDATE` to the primary database.
3. The database **locks the seat's row** for the first update to arrive (Ann's). Ben's update has to wait.
4. Ann's update changes the seat to `held` and commits.
5. Ben's update now runs and **checks its `WHERE` condition again**. The seat is `held` and the hold has not expired, so no row matches, and **0 rows are changed**.
6. Ben's app server gets "0 rows" and answers `409`, so Ben is told to choose another seat.

The database lets only one of the two updates succeed. The app servers do not need to talk to each other.

### The layers of protection

1. **Atomic conditional update.** A seat can only move from `available` (or an expired hold) to `held` by one request at a time, as shown above.
2. **A transaction for several seats.** When a user holds more than one seat, all the updates run in one transaction. If any seat is already taken, the app **rolls back**, so the user never ends up holding half of what they asked for. Seats are always locked in ascending id order, which prevents two buyers from blocking each other (a deadlock).
3. **Holds expire.** A hold lasts 5 minutes. A worker returns expired holds to `available`, and an expired hold can also be taken over directly by the update above. This stops abandoned baskets from locking seats forever.
4. **The purchase re-checks the hold.** Paying only works for seats still held by that user and not expired:

   ```sql
   UPDATE seats
   SET status = 'sold', held_by = NULL, hold_expires_at = NULL
   WHERE id = :seat_id
     AND status = 'held'
     AND held_by = :user_id
     AND hold_expires_at >= datetime('now');
   ```

   The app checks that it changed **one row for every seat** in the order. When payment starts, the hold is extended by 2 minutes, so it cannot expire while the card is being charged. If the final step still fails, the payment is refunded by a background job and the user is told.
5. **Constraints are the last line of defence.** Even if there were a bug in the app code, the database refuses bad data:
   - `UNIQUE (seat_id)` on `tickets` means a seat can never appear on two tickets.
   - `UNIQUE (payment_ref)` on `orders` means one payment can never create two orders, and together with the `Idempotency-Key` header it stops a retried request from charging twice.
   - A `CHECK` on `seats` means a seat has an owner and an expiry time **only** while it is held.
   - `UNIQUE (event_id, section, row_label, seat_number)` means a seat position exists only once.

### Why seat updates use the database and not the cache

The cache is fast but can be slightly out of date, so it is only used to **show** the seat map. The decision about who gets a seat is always made by the primary database. If the cache shows a seat as available when it has just been taken, the user simply gets a `409` and picks another seat.

## 6. Architecture

### Diagram

```
          Client (browser or mobile app)
                       |
                       v
                  +---------+
                  |   DNS   |
                  +----+----+
                       |
                       v
                  +---------+     serves images, scripts and
                  |   CDN   |     cached event pages from the edge
                  +----+----+
                       |  everything that is not cached
                       v
              +------------------+
              |  Load balancer   |    (with rate limiting)
              +--------+---------+
                       |
                       v
              +------------------+
              |   Waiting room   |    lets about 50 people per second
              +--------+---------+    into a big sale
                       |
          +------------+------------+
          |                         |
          v                         v
    +------------+            +------------+
    | App server |    ....    | App server |    (many, added automatically
    +-----+------+            +------+-----+     when traffic grows)
          |                          |
          +------------+-------------+
                       |
     +-----------------+------------------+------------------+
     |                 |                  |                  |
     v                 v                  v                  v
+---------+     +-------------+     +-----------+     +------------+
|  Cache  |     |   Primary   |     |   Queue   |     |  Payment   |
| (Redis) |     |  database   |     +-----+-----+     |  provider  |
+---------+     +------+------+           |           | (external) |
                       |                  v           +------------+
                copies changes      +-----------+
                       |            |  Workers  |
                       v            +-----------+
                +-------------+
                |    Read     |
                |  replicas   |
                +-------------+
```

How to read it: reads go to the **cache** first, then to the **read replicas**. Seat holds and purchases go to the **primary database**. Slow jobs go onto the **queue** for the **workers**. The card payment is handled by an **external payment provider**.

### What each component does

- **DNS:** it turns `tickethub.example.com` into an address, which solves the problem of users needing to remember numeric addresses and lets us move servers without changing the name.
- **CDN:** it serves images, scripts and cached event pages from servers close to the user, which solves slow loading for faraway users and keeps most browsing traffic away from our own servers.
- **Load balancer (with rate limiting):** it spreads requests across the app servers, skips servers that are down, and blocks addresses that send far too many requests, which solves overload and stops bots from flooding the sale.
- **Waiting room:** it holds extra visitors in an orderly queue and lets only about 50 people per second into the buying pages, which solves the problem of 200,000 people hitting the seat and payment code at once and makes the sale fair.
- **App servers:** they run the TicketHub logic (browsing, holding seats, orders) and keep no data of their own, which solves the problem of one machine not coping, because we can add more identical servers during a sale.
- **Cache (Redis):** it keeps event details and seat maps in fast memory for a few seconds, and stores the waiting room's queue, which solves the problem of the database answering the same seat-map query thousands of times a second.
- **Primary database:** it stores users, events, seats, orders and tickets, and it is the only place where seats are held and sold, which solves the problem of keeping every seat exact and never double-sold.
- **Read replicas:** they are live copies of the primary that answer read queries such as browsing and "my tickets", which solves the problem of read traffic slowing down the seat updates on the primary.
- **Queue:** it holds background jobs until a worker is ready, which solves the problem of slow tasks (emails, refunds) making the buyer wait and of jobs being lost in a traffic surge.
- **Workers:** they take jobs from the queue, such as sending tickets by email, releasing expired holds and refunding failed orders, which solves the problem of doing slow work during the buyer's request.
- **Payment provider (external):** it charges the card and keeps the card details, which solves the problem of TicketHub having to store sensitive card data securely.

### How the design survives the big sale

- **The waiting room protects the database.** The 200,000 visitors do not all reach the buying code. About 50 people per second are admitted, which is 30,000 people in 10 minutes for 20,000 seats, and the extra people cover shoppers who give up. The primary database sees tens of seat updates per second, not thousands.
- **The CDN and the cache take the reads.** Images, scripts and event pages come from the CDN. The seat map is cached for about 2 seconds, so the database answers a seat-map query about once every 2 seconds, however many people are looking.
- **Fast failure once sold out.** When the last seat is sold, the event is marked `sold_out` in the cache. Everyone still in the queue or on the page is told immediately, and no further load reaches the database.
- **App servers scale out.** More servers are added automatically as traffic grows, and the team adds capacity before the on-sale time because the sale time is known in advance.
- **Holds make payment safe.** Because a seat is held for 5 minutes, a slow payment cannot cause someone else to buy the same seat.
- **Slow work leaves the buying path.** Emails, refunds and cleanup run through the queue.
- **Fairness is built in.** People who join the waiting room in the first 2 minutes get random places in line, so a faster connection does not win, and later arrivals are served in the order they joined. Each account is limited to 4 tickets per event, and suspicious traffic is blocked or challenged.
- **Load testing.** Before a big sale, the team simulates the expected traffic against a copy of the system to find its limits.

### Buying flow

1. The user joins the waiting room, waits for their turn, and receives an admission pass.
2. The user chooses seats on the seat map (served from the cache).
3. The app server runs the atomic hold update for each seat in one transaction. If any seat is taken, everything is rolled back and the user gets `409`.
4. The user pays. The hold is extended by 2 minutes and the card is charged through the payment provider.
5. In one transaction, the app server marks the seats `sold`, creates the order and creates the tickets. The unique constraints give a last check.
6. If this final step fails (for example, the hold was lost), the payment is refunded through the queue and the user is told.
7. A worker emails the tickets, and the tickets appear under `GET /me/tickets`.

### Single points of failure

- **App servers, workers and read replicas:** there are several of each, so losing one does not stop the service.
- **Primary database:** a standby copy is promoted automatically if the primary fails, and backups are taken regularly.
- **Cache and waiting room state:** Redis is replicated with automatic failover. If it is lost, the app falls back to the database for seat maps, which is slower but works.
- **Queue:** a replicated, durable queue with a dead-letter list for jobs that keep failing.
- **Payment provider:** if it is down, holds simply run out and users can try again. Payments are always sent with an idempotency key so retries never charge twice.

## 7. Trade-offs

1. **Waiting room: protection and fairness against delay.** The waiting room keeps the site alive and gives everyone an orderly chance, but it makes buyers wait, and 180,000 of the 200,000 people are still disappointed. It also adds another service to build and run. We accept this because a crashed site would be worse for everyone.
2. **Hold time: more chances to pay against locked seats.** A 5-minute hold is long enough to enter card details, but while a person hesitates, other buyers cannot get those seats. A shorter hold frees seats faster but makes more people lose their seats while paying. We chose 5 minutes, plus 2 extra minutes once payment starts.
3. **Strong consistency against scaling.** Putting all seat changes on one primary database gives exact, safe results, but it limits how many seat updates per second we can handle, and a very popular event concentrates the load on a few rows. This is fine for 20,000 seats, but a much larger system would need to split events across several databases (sharding), which is harder to run. A faster in-memory store for holds would be quicker but risks the cache and database disagreeing about who owns a seat.
4. **Cached seat map: lower load against stale information.** Caching the seat map for 2 seconds protects the database, but users may click a seat that has just been taken and get a `409`. We accept an occasional "seat just taken" message because the final decision is always checked in the database.
5. **Anti-bot limits against convenience.** Limiting each account to 4 tickets and blocking suspicious traffic keeps the sale fair, but it can annoy real buyers, for example a person buying for a large group.
