import { Router, Request, Response, NextFunction } from "express";
import sqlite3 from 'sqlite3';
// import { promisify } from 'util';

const router = Router();

router.post('/evaluate-query', evaluateQuery);

const DML_QUERIES = ['insert', 'update', 'delete', 'truncate'];
const DDL_QUERIES = ['create', 'alter', 'drop'];

function compareResults(userResult: any, answerResult: any, select_order: boolean) {
  console.log(`userResult: ${JSON.stringify(userResult)}`);
  console.log(`answerResult: ${JSON.stringify(answerResult)}`);

  if (hasDifferentRowCount(userResult, answerResult)) {
    const difference = Math.abs(userResult.length - answerResult.length);
    const isUserResultGreater = userResult.length > answerResult.length;

    console.log(`Difference: ${difference} ${(isUserResultGreater ? 'extra' : 'missing')} row(s)`);

    return {
      status: false,
      message: `Difference: ${difference} ${(isUserResultGreater ? 'extra' : 'missing')} row(s)`,
    };

  } else {
    const missingColumns = getMissingColumns(userResult[0], answerResult[0]);
    const extraColumns = getExtraColumns(userResult[0], answerResult[0]);

    let message = '';

    if (missingColumns.length > 0) {
      message += `Missing columns: ${missingColumns.join(", ")}`;
      console.log(`Missing columns: ${missingColumns.join(", ")}`);
    }

    if (extraColumns.length > 0) {
      message += `${message.length > 0 ? ' ' : ''}Extra columns: ${extraColumns.join(", ")}`;
      console.log(`Extra columns: ${extraColumns.join(", ")}`);
    }

    if (missingColumns.length > 0 || extraColumns.length > 0) {
      return {
        status: false,
        message: message,
      };
    }

    if (select_order) {
      for (let i = 0; i < userResult.length; i++) {
        const row1 = userResult[i];
        const row2 = answerResult[i];

        const differences = findDifferences(row1, row2);

        if (differences.length > 0) {
          console.log(`Rows not in expected order: \n${differences.join("\n")}`);
          return {
            status: true,
            message: `Rows not in expected order \n${differences.join("\n")}`,
          };
        }
      }
    }

    console.log("No difference");
    return {
      status: true,
      message: "No difference",
    };
  }
}

function hasDifferentRowCount(userResult: any[], answerResult: any[]): boolean {
  return userResult.length !== answerResult.length;
}

function getMissingColumns(obj1: any, obj2: any): string[] {
  const columnNamesObj1 = Object.keys(obj1);
  const columnNamesObj2 = Object.keys(obj2);

  return columnNamesObj2.filter((colName) => !columnNamesObj1.includes(colName));
}

function getExtraColumns(obj1: any, obj2: any): string[] {
  const columnNamesObj1 = Object.keys(obj1);
  const columnNamesObj2 = Object.keys(obj2);

  return columnNamesObj1.filter((colName) => !columnNamesObj2.includes(colName));
}

function findDifferences(row1: any, row2: any): string[] {
  const differences = [];

  for (const columnName in row1) {
    if (row1.hasOwnProperty(columnName) && row2.hasOwnProperty(columnName)) {
      if (row1[columnName] !== row2[columnName]) {
        differences.push(`for column ${columnName} values are different : ${row1[columnName]} <> ${row2[columnName]}`);
      }
    }
  }

  return differences;
}

async function evaluateQuery(req: Request, res: Response) {
  const seedQuery = req.body.seed_query;
  
  const userQuery = req.body.user_query;
  // const queryCategory = req.body.query_category;
  const answerQuery = req.body.answer_query;
  const queryType = req.body.query_type;
  const tableName = req.body.table_name;
  const verifyQuery = req.body.verify_query;

    // Validate input parameters
    const missingParams = [];
    if (!seedQuery) {
      missingParams.push("seed_query");
    }
    if (!userQuery) {
      missingParams.push("user_query");
    }

    if (!answerQuery) {
      missingParams.push("answer_query");
    }

    if (!queryType) {
      missingParams.push("query_type");
    }
  
    if ((DML_QUERIES.includes(queryType) || DDL_QUERIES.includes(queryType)) && !verifyQuery) {
      missingParams.push("verify_query");
    }

    if (missingParams.length > 0) {
      return res.status(400).json({ error: `Missing required input parameters: ${missingParams.join(", ")}` });
    }
    
  try {

      // Execute user query
      const userResult = await executeQuery(seedQuery, userQuery, verifyQuery);
      console.log(`userResult: ${JSON.stringify(userResult)}`);

      if (!userResult || userResult.length === 0) {
        throw new Error("Error executing user query or empty result");
      }

      const answerResult = await executeQuery(seedQuery, answerQuery, verifyQuery);
      console.log(`answerResult: ${JSON.stringify(answerResult)}`);

      if (!answerResult || answerResult.length === 0) {
        throw new Error("Error executing answer query or empty result");
      }

      // If this is select type query then compare direct results, 
      // If ['insert', 'update', 'delete', 'truncate'] theb compare results of select * from table_name query
      // If this is ['describe/Create/Alter/Drop (DML)] describe table_name query

      const selectOrder = (queryType === 'select-with-order');


      const comparison = compareResults(userResult, answerResult, selectOrder);
      console.log(`comparison: ${JSON.stringify(comparison)}`);


      res.json({
          // query_category: queryCategory,
          user_query: userQuery,
          is_correct: comparison.status,
          message: comparison.message,
          user_result: userResult,
          answer_result: answerResult,
      });

  } catch (error: any) {
      res.status(500).json({ error: error.message });
  }
}

function formatQueriesForDbRun(queries: string) {
  const queryList = queries.split(';').map(query => query.trim()).filter(query => query.length > 0);
  return queryList;
}

async function executeQuery(seed_query: string, query: string, verifyQuery?: string): Promise<any> {
  console.log('Executing query...');
  console.log('Seed Query:', seed_query);
  console.log('Query:', query);
  if (verifyQuery) {
    console.log('Select Query:', verifyQuery);
  }

  const db = new sqlite3.Database(':memory:'); // Open a new database connection

  try {
    await runSeedQueries(db, seed_query);

    // const query1 = "CREATE TABLE users2 (id INT, name TEXT, age INT, email TEXT, address TEXT);"
    // const row_afffected =  await runDMLDDLQuery(db, query1);
    // console.log('row_afffected', row_afffected)

    const result1 = await executeFirstQuery(db, query);

    if (verifyQuery) {
      const result2 = await executeSecondQuery(db, verifyQuery);
      return result2; // Return the result of the second query
    } else {
      return result1; // Return the result of the first query
    }
  } finally {
    db.close(); // Close the database connection
  }
}

// if (verifyQuery) {
//   const row_afffected =  await runDMLDDLQuery(db, verifyQuery);
//   console.log('row_afffected', row_afffected);
//   const result2 = await executeSecondQuery(db, verifyQuery);
//   return [row_afffected, result2]; // Return the result of the second query
// }
// else{
//   const result1 = await executeFirstQuery(db, query);
//   return [0, result1]; // Return the result of the second query
// }


function runSeedQueries(db: any, seed_query: string): Promise<void> {
  const formattedQueries = formatQueriesForDbRun(seed_query);
  console.log('formattedQueries', formattedQueries);

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      formattedQueries.forEach(query => {
        db.run(query);
      });
      resolve();
    });
  });
}

function runDMLDDLQuery(db: any, query: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const query1 = "INSERT INTO users VALUES (2, 'John2', 2, 'john2@example.com', 'house number:2')"
    const query2 = 'update users set name = "Girish"'
    db.run(query, [], function(this: any, err: any) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
}

function executeFirstQuery(db: any, query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (query) {
      db.all(query, [], (err: Error | null, result: any) => {
        if (err) {
          reject(err);
        } else {
          console.log('First query executed successfully:', query);
          resolve(result); // Resolve with the result of the first query
        }
      });
    } else {
      reject(new Error('query is required.'));
    }
  });
}

function executeSecondQuery(db: any, verifyQuery: string): Promise<any> {
  return new Promise((resolve, reject) => {
    db.all(verifyQuery, [], (err: Error | null, result: any) => {
      if (err) {
        reject(err);
      } else {
        console.log('Second query executed successfully:', verifyQuery);
        resolve(result); // Resolve with the result of the second query
      }
    });
  });
}

export default router;
