# SnapShare Scaling Plan

SnapShare is a photo-sharing app. Users upload photos and scroll a feed of photos from the people they follow. This plan estimates the load on the system and designs an architecture that can handle it.

## 1. Assumptions

- There are **10,000,000 registered users**.
- **10%** of them are active each day.
- Each active user uploads **1 photo per day** and views **50 feed pages per day**.
- An average photo is **2 MB**, and each photo also gets a **50 KB thumbnail**.
- There are **86,400 seconds** in a day, and traffic is spread evenly for the average figures.
- **Peak traffic is 5 times the average**.
- Storage is counted for **365 days** with no growth, no deleted photos and **decimal units** (1 TB = 1,000,000 MB).
- Each photo needs about **1 KB of metadata** in the database (owner, storage location, date, caption).
- Object storage keeps extra copies of every file for safety, so real disk use would be 2 to 3 times the figures below. This is left out to keep the arithmetic simple.

**Daily active users (DAU):** 10,000,000 × 10% = **1,000,000 users per day**.

## 2. Estimates

### Uploads

- Uploads per day: 1,000,000 users × 1 photo = **1,000,000 uploads per day**
- Average uploads per second: 1,000,000 ÷ 86,400 ≈ **11.6 per second**
- Peak uploads per second: 11.6 × 5 ≈ **58 per second**
- Peak upload bandwidth: 58 × 2 MB ≈ **116 MB per second** (about 0.9 Gbps)

### Feed views

- Feed views per day: 1,000,000 users × 50 = **50,000,000 views per day**
- Average feed views per second: 50,000,000 ÷ 86,400 ≈ **579 per second**
- Peak feed views per second: 579 × 5 ≈ **2,900 per second**

### Storage

| Item | Per day | Per year (× 365) |
| --- | --- | --- |
| Original photos | 1,000,000 × 2 MB = 2 TB | **730 TB** |
| Thumbnails | 1,000,000 × 50 KB = 50 GB | **18.25 TB** |
| **Total photo storage** | **2.05 TB** | **about 748 TB (0.75 PB)** |
| Database metadata | 1,000,000 × 1 KB = 1 GB | about 365 GB |

### Summary table

| Measure | Average | Peak (5×) |
| --- | --- | --- |
| Uploads per second | 11.6 | 58 |
| Feed views per second | 579 | 2,900 |

## 3. Read-heavy or write-heavy?

SnapShare is **read-heavy**. There are 50,000,000 feed views per day but only 1,000,000 uploads per day, so there are **50 times more reads than writes**. In practice the gap is even larger, because one feed view shows many photos.

What this means for the design:

- **Make reads cheap and fast.** Use a cache and a CDN so that most requests never reach the database.
- **Spread reads across copies.** Use a database read replica for reads that the cache cannot answer.
- **Let writes be slower and asynchronous.** Writes are rare, so work such as making thumbnails can happen in the background through a queue.
- **Scale the read path first.** Adding more app servers, cache and CDN capacity helps far more than speeding up writes.

## 4. Why photos should not be stored in the database

Photos are large files, and 730 TB of originals per year is far too much for a database. Storing them there would cause these problems:

- **Cost:** database storage is much more expensive than object storage.
- **Speed:** large files slow down the database, and the same database must also answer fast queries such as "who does this user follow?"
- **Backups and replication:** every copy and every backup would have to move hundreds of terabytes.
- **Delivery:** a database cannot serve files directly to users over HTTP, and it cannot work with a CDN.

**Where they go instead:** photos and thumbnails go into **object storage** (a service built for huge numbers of files, such as Amazon S3). The database only stores small **metadata** about each photo, including the file's storage key. The CDN then delivers the files from object storage to users around the world.

## 5. Architecture diagram

```
        Users (mobile app and web browser)
          |                                |
          | download photos                | feed, upload, follow
          | and thumbnails                 | requests
          v                                v
    +-----------+                 +-----------------+
    |    CDN    |                 |  Load balancer  |
    +-----+-----+                 +--------+--------+
          |                                |
          | cache miss                     v
          |                       +-----------------+
          |                       |   App servers   |
          |                       |  (many copies)  |
          |                       +--------+--------+
          |                                |
          |          +---------------------+---------------------+
          |          |                     |                     |
          |          v                     v                     v
          |     +---------+         +------------+         +---------+
          |     |  Cache  |         |  Primary   |         |  Queue  |
          |     | (Redis) |         |  database  |         +----+----+
          |     +---------+         +-----+------+              |
          |                               |                     v
          |                          copies data         +------------+
          |                               v              | Thumbnail  |
          |                         +-----------+        |   worker   |
          |                         |   Read    |        +-----+------+
          |                         |  replica  |              |
          |                         +-----------+              |
          v                                                    |
    +-------------+                                            |
    |   Object    |<-------------------------------------------+
    |   storage   |    worker reads the original and saves
    | photos and  |    the 50 KB thumbnail here
    | thumbnails  |
    +-------------+
```

Notes on reading the diagram:

- The **CDN** serves photo files. When it does not have a file (a cache miss), it fetches it from **object storage**.
- The **app servers** also save each new original photo into **object storage** (not drawn, to keep the lines readable).
- The **worker** reads the original from object storage and writes the thumbnail back.
- Feed requests go through the load balancer and app servers, which check the **cache** first and the **database** second.

## 6. What each component does

- **CDN:** it keeps copies of popular photos and thumbnails on servers close to users, which solves slow image loading for people far from our data centre and removes most of the load from object storage.
- **Load balancer:** it spreads incoming requests across many app servers, which solves the problem of one server being overloaded and of the whole app going down if a single server fails.
- **App servers:** they run the SnapShare logic (login, feed, upload) and solve the problem of one machine being unable to handle thousands of requests per second, because we can simply add more identical servers.
- **Cache (Redis):** it keeps frequently used data such as ready-made feeds in fast memory, which solves the problem of the database being hit by the same read query thousands of times.
- **Database (primary):** it stores users, follows, photo metadata and captions in a reliable, structured form, which solves the problem of keeping important data consistent and queryable, and it takes all writes.
- **Read replica:** it is a live copy of the primary database that handles read queries, which solves the problem of read traffic overloading the primary and gives us a backup if the primary fails.
- **Object storage:** it stores the photo files cheaply and almost without limit, which solves the problem of keeping hundreds of terabytes of images that a database could not hold.
- **Queue:** it holds jobs such as "make a thumbnail for photo 123" until a worker is ready, which solves the problem of slow background work holding up the user's upload and of jobs being lost during traffic spikes.
- **Thumbnail worker:** it takes jobs from the queue and creates the 50 KB thumbnail, which solves the problem of users downloading a 2 MB image just to see a small preview in the feed.

## 7. Upload flow, step by step

1. The user picks a photo in the app and sends it to SnapShare over HTTPS.
2. The **load balancer** forwards the request to a healthy **app server**.
3. The app server checks that the user is logged in and that the file is a valid image of an allowed size.
4. The app server saves the **original photo** into **object storage** and gets back its storage key.
5. The app server writes a **metadata row** to the **primary database** (photo id, owner, storage key, upload time, status "processing").
6. The app server puts a **"create thumbnail"** job for that photo on the **queue**.
7. The app server replies to the user straight away with success, so the user does not wait for the thumbnail.
8. A **thumbnail worker** takes the job from the queue, downloads the original from object storage and resizes it to a 50 KB thumbnail.
9. The worker saves the thumbnail into **object storage** and updates the database row to status "ready" with the thumbnail's storage key.
10. If the worker fails, the job goes back on the queue and is retried. After several failures it moves to a separate "failed jobs" list for a person to look at.
11. The **feed cache** of the user's followers is updated or cleared, so the new photo shows up the next time they load their feed.
12. The first time a follower views the thumbnail, the **CDN** fetches it from object storage and keeps a copy, so every later view is served by the CDN.

## 8. Trade-offs

1. **Caching makes feeds fast but possibly out of date.** A cached feed may not show a photo uploaded a few seconds ago, or may still show a photo that was just deleted. We accept this because feeds are read about 50 times more than they change, and a short delay is better than a slow app. A shorter cache lifetime gives fresher data but sends more traffic to the database.
2. **A read replica gives more read capacity but can lag behind.** Copying data from the primary takes a short time, so a read from the replica may not include a write made a moment ago. This is called eventual consistency. A user could upload a photo and not see it in their own profile right away. We can reduce this by reading a user's own recent data from the primary.
3. **Making thumbnails in the background keeps uploads fast but adds delay and complexity.** Because the thumbnail is made after the upload succeeds, a photo can briefly appear without its thumbnail. Making it during the upload would be simpler but would make every upload slower and would fail if the thumbnail step failed. We also have to run and monitor a queue and workers.
4. **A CDN and large object storage cost money.** Serving images worldwide and keeping about 748 TB of new files per year is expensive. To reduce cost we could move old, rarely viewed photos to cheaper "cold" storage, but then opening an old photo would be slower.
