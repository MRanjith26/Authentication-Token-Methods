const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "goodreads.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

// Get Books API
app.get("/books/", async (request, response) => {
  //Get JWT Token from headers
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    //header contains [bearer(0) Token(1)]
    jwtToken = authHeader.split(" ")[1];
  }
  //If JWT Token is absent
  if (jwtToken === undefined) {
    //Not Authorized(401)
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    //Verify JWT Token
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        //Invalid JWT Token
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        //valid JWT Token
        const getBooksQuery = `
            SELECT
                *
            FROM
                book
            ORDER BY
                book_id;`;
        const booksArray = await db.all(getBooksQuery);
        response.send(booksArray);
      }
    });
  }
});

// User Register API
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
    SELECT 
      * 
    FROM 
      user 
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
     INSERT INTO
      user (username, name, password, gender, location)
     VALUES
      (
       '${username}',
       '${name}',
       '${hashedPassword}',
       '${gender}',
       '${location}'  
      );`;
    await db.run(createUserQuery);
    response.send("User created successfully");
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      //creating user credentials
      const payload = { username: username };
      //Generating JWT Token using sign method
      //"MY_Token" is random string for secreatKey
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      //send jwt Token as HTTP response
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});
