const axios = require('axios');
let data = JSON.stringify({
  "seed_query": "CREATE TABLE students (id INTEGER PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, age INTEGER); INSERT INTO students (first_name, last_name, age) VALUES ('John', 'Doe', 20); INSERT INTO students (first_name, last_name, age) VALUES ('Jane', 'Smith', 22); INSERT INTO students (first_name, last_name, age) VALUES ('Michael', 'Johnson', 19);",
  "user_query": "CREATE VIEW student_names AS SELECT id, first_name || ' ' || last_name AS full_name FROM students;",
  "query_type": "CREATE",
  "answer_query": "CREATE VIEW student_names AS SELECT id, first_name || ' ' || last_name AS full_name FROM students;",
  "table_name": "student_names",
  "verify_query": "SELECT * FROM student_names;"
});

let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'localhost:2001/api/v1/evaluate-query',
  headers: { 
    'Content-Type': 'application/json'
  },
  data : data
};

axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});
