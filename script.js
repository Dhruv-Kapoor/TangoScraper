const SECRETS = require("/home/dhruv/Desktop/crons/secrets.json");

const FIRESTORE_CREDS_PATH = SECRETS.FIRESTORE_CREDS_PATH;

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const serviceAccount = require(FIRESTORE_CREDS_PATH);

initializeApp({
  credential: cert(serviceAccount),
});

async function migrateDb() {
  const db = getFirestore();

  var grids = await db.collection("grids").get();

  grids.forEach(async (doc) => {
    const grid = doc.data();
    const participants = await doc.ref.collection("participants").get();
    if (!participants.empty) {
      participants.forEach((participant) => {
        participant.ref.set(
          {
            gridNumber: grid.number,
            gridType: grid.type
          },
          { merge: true }
        );
      });
    }
  });
}

// run();

async function dumpGrids() {
  const db = getFirestore();
  const fs = require("node:fs");

  var grids = await db.collection("grids").get();

  const data = []
  grids.forEach(async (doc) => {
    data.push(doc.data())
  })

  fs.writeFile("grids.json", JSON.stringify(data), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("File written");
    }
  });
}
dumpGrids()