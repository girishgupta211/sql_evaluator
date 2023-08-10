/**
 * This code sets up an Express server and provides an endpoint for evaluating user queries against a SQLite database.
 */

// Import required modules
const express = require('express'); // Framework for building web applications
const sqlite3 = require('sqlite3').verbose(); // SQLite database library

// Create an instance of the Express application
const app = express();

// Set the port number for the server
const PORT = 3000;

// Configure the Express application to parse JSON bodies
app.use(express.json());

/**
 * Endpoint to evaluate user query
 * POST /evaluate-query
 * 
 * @param {Object} req - HTTP request object containing seed_query, user_query, query_category, and answer_query in the request body
 * @param {Object} res - HTTP response object used to send a JSON response
 */
app.post('/evaluate-query', evaluateQuery);

/**
 * Function to evaluate the user query against the seed query in a SQLite database
 * 
 * @param {Object} req - HTTP request object containing seed_query, user_query, query_category, and answer_query in the request body
 * @param {Object} res - HTTP response object used to send a JSON response
 */
async function evaluateQuery(req, res) {
    const seedQuery = req.body.seed_query;
    const userQuery = req.body.user_query;
    const queryCategory = req.body.query_category;
    const answerQuery = req.body.answer_query;

    // Validate the query category
    if (queryCategory !== 'dml' && queryCategory !== 'ddl' && queryCategory !== 'select') {
        return res.status(400).json({ error: 'Invalid query category' });
    }

    try {
        console.log("User Query:", userQuery);
        console.log("seedQuery:", seedQuery);

        // Execute the user query
        const userResult = await executeQuery(seedQuery, userQuery);
        console.log("User Query Result:", userResult);

        console.log("answerQuery:", answerQuery);
        const answerResult = await executeQuery(seedQuery, answerQuery);
        console.log(answerResult)

        // Compare the user and answer results
        const isCorrect = JSON.stringify(userResult) === JSON.stringify(answerResult);

        res.json({
            query_category: queryCategory,
            user_query: userQuery,
            is_correct: isCorrect,
            user_result: userResult,
            answer_result: answerResult
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * Function to execute a query in a SQLite database
 * 
 * @param {string} seed_query - Seed query used to initialize the database with tables and data
 * @param {string} query - User query to be executed in the database
 * @returns {Promise<Array>} A promise that resolves to an array of query results
 */
async function executeQuery(seed_query, query) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(':memory:'); // Open a new in-memory database connection

        // Function to format a list of queries for execution in the database
        function formatQueriesForDbRun(queries) {
            const queryList = queries.split(';').map(query => query.trim()).filter(query => query.length > 0);
            return queryList;
        }

        const formattedQueries = formatQueriesForDbRun(seed_query);

        // Serialize the database operations to ensure queries are executed sequentially
        db.serialize(() => {
            formattedQueries.forEach(query => {
                db.run(query); // Execute each query in the seed query
            });
        });

        // Execute the user query
        db.all(query, [], (err, result) => {
            if (err) {
                reject(err);
            } else {
                console.log('Query executed successfully');
                resolve(result); // Resolve the promise with the query result
            }
        });
    });
}

// Start the server and listen on the specified port
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
