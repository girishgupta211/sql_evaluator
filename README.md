This code is a Node.js application that uses Express as the framework for building a web server. It provides an endpoint (
/evaluate-query
) to evaluate user queries against a SQLite database. The server listens on port 3000.

The 
/evaluate-query
 endpoint accepts a POST request and expects the request body to contain four properties: 
seed_query
, 
user_query
, 
query_category
, and 
answer_query
. The 
seed_query
 represents the initial set of queries used to initialize the database with tables and data. The 
user_query
 is the query provided by the user to be evaluated. The 
query_category
 specifies the category of the query (either 'dml', 'ddl', or 'select'). The 
answer_query
 is the expected correct answer for the user



How to run 
curl --location 'http://localhost:3000/evaluate-query' \
--header 'Content-Type: application/json' \
--data '{
    "seed_query": "CREATE TABLE users (id INT, name TEXT); INSERT INTO users VALUES (1, '\''John'\'');",
    "user_query": "SELECT * FROM users;",
    "query_category": "select",
    "answer_query": " SELECT * FROM users;"
}
'

Response:

{"query_category":"select","user_query":"SELECT * FROM users;","is_correct":true,"user_result":[{"id":1,"name":"John"}],"answer_result":[{"id":1,"name":"John"}]}%


 
