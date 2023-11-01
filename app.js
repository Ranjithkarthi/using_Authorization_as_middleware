const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

//initializing Database And Server Function
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    consloe.log(`Db Error:${e.message}`);
  }
};

initializeDbAndServer();

//state table case conversion function
const convertToCamelCase = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUsername = `SELECT * FROM user WHERE username = '${username}';`;
  const dbResponse = await db.get(checkUsername);
  if (dbResponse !== undefined) {
    const isPasswordMatched = await bcrypt.compare(
      password,
      dbResponse.password
    );
    if (isPasswordMatched === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: "${username}" };
      const jwtToken = jwt.sign(payload, "krsn");
      response.status(200);
      response.send({ jwtToken });
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});
//Authorization Middleware Function
const authorization = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "krsn", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//2 get all states
app.get("/states/", authorization, async (request, response) => {
  try {
    const dbQuery = "SELECT * FROM state;";
    const dbResponse = await db.all(dbQuery);
    response.send(dbResponse.map((eachArray) => convertToCamelCase(eachArray)));
  } catch (e) {
    console.error(`Db Error: ${e.message}`);
  }
});

//3 get State based On stateId
app.get("/states/:stateId/", authorization, async (request, response) => {
  try {
    const { stateId } = request.params;
    const dbQuery = `SELECT * FROM state
    WHERE state_id = ${stateId};`;
    const dbResponse = await db.get(dbQuery);
    response.send(convertToCamelCase(dbResponse));
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
});

//4 post new row in district table
app.post("/districts/", authorization, async (request, response) => {
  try {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const dbQuery = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
            VALUES (
                '${districtName}',
                ${stateId},
                ${cases},
                ${cured},
                ${active},
                ${deaths}
            );`;
    await db.run(dbQuery);
    response.send("District Successfully Added");
  } catch (error) {
    console.error(`Post Error: ${error.message}`);
  }
});

//District CamelCase conversion
const convertDistrictCamelCase = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//5 return district based on districtId
app.get("/districts/:districtId/", authorization, async (request, response) => {
  const { districtId } = request.params;
  const dbQuery = `SELECT * FROM district
    WHERE district_id = ${districtId}`;
  const dbResponse = await db.get(dbQuery);
  response.send(convertDistrictCamelCase(dbResponse));
});

//6 Delete row from district using id
app.delete(
  "/districts/:districtId/",
  authorization,
  async (request, response) => {
    const { districtId } = request.params;
    const dbQuery = `DELETE FROM district 
    WHERE district_id = ${districtId};`;
    await db.run(dbQuery);
    response.send("District Removed");
  }
);

//7 Update district by id
app.put("/districts/:districtId/", authorization, async (request, response) => {
  try {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const dbQuery = `UPDATE district
            SET 
            district_name='${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
            WHERE district_id = ${districtId};`;
    await db.run(dbQuery);
    response.send("District Details Updated");
  } catch (error) {
    console.error(`put Error: ${error.message}`);
  }
});

//8 get sum of district details
app.get("/states/:stateId/stats/", authorization, async (request, response) => {
  const { stateId } = request.params;
  const dbQuery = `SELECT 
    SUM(cases) as totalCases,
    SUM(cured) as totalCured, 
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths
    FROM district
    WHERE state_id = ${stateId}`;
  const dbResponse = await db.get(dbQuery);
  response.send(dbResponse);
});

module.exports = app;
