# Reflection

## The most difficult concept

The hardest concept for me was asynchronous JavaScript: `fetch`, `async` and `await`. Code that does not run line by line, with a result that arrives later, was confusing at first. I found it hard to see why a page needs loading, success and error states, and why every request needs `try` and `catch`.

## How I overcame it

I got comfortable by building it step by step. On Day 5 I wrote `loadUsers()` and tested the error path by breaking the URL on purpose. I watched the error message appear and the button switch back on in the `finally` block, and seeing the failure happen made it real. In my capstone I turned the pattern into one reusable `request()` function that checks `response.ok` and throws on errors, and I used it for GET, POST and DELETE.

## What I would improve

The part of my capstone I would improve most is testing and error handling. I tested the client by clicking through it by hand. Next time I would write automated tests for the validation and the failure cases, and show clearer messages for different errors, such as a network failure compared with a server error.

## What I will learn next

I want to learn back-end development with Node.js and databases. In the capstone I designed an API and a database on paper, and I would like to build the real thing, so that my front end talks to my own server instead of a practice API.
