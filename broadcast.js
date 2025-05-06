const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const https = require("https");

const { delay, sendPushNotification, getLastFetchedId } = require("./utils");

const WORKFLOW_DURATION = 5.5 * 60 * 60 * 1000;
const TERMINATE_DELAY = 1 * 60 * 1000;

const config = {
  pat: process.env.PAT,
  repository: "Dhruv-Kapoor/TangoScraper",
  workflowFile: "broadcast.yml",
  ref: "master",
  inputs: {},
};

async function handleParticipantDoc(doc) {
  LAST_FETCHED_FILES = {
    1: "latest_tango.txt",
    2: "latest_queens.txt",
    3: "latest_zip.txt",
  };
  LABELS = {
    1: "Tango",
    2: "Queens",
    3: "Zip",
  };
  if (
    doc.gridNumber == (await getLastFetchedId(LAST_FETCHED_FILES[doc.gridType]))
  ) {
    const userDoc = (
      await getFirestore().collection("users").doc(doc.id).get()
    ).data();
    if (!userDoc.preferences || userDoc.preferences.broadcast_enabled != false) {
      sendPushNotification(
        "broadcast",
        `${userDoc.name} completed ${LABELS[doc.gridType]} in ${
          doc.firstAttempt
        } seconds`,
        "",
        {
          route: LABELS[doc.gridType].toLowerCase(),
        },
        {
          android: {
            priority: "high",
          },
        }
      );
    } else {
      console.log(`broadcast is disabled for user: ${doc.id}`);
    }
  }
}

function triggerWorkflow() {
  const postData = JSON.stringify({
    ref: config.ref,
    inputs: config.inputs,
  });

  const options = {
    hostname: "api.github.com",
    path: `/repos/${config.repository}/actions/workflows/${config.workflowFile}/dispatches`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.pat}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Node.js",
      "Content-Type": "application/json",
      "Content-Length": postData.length,
    },
  };

  const req = https.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);

    res.on("data", (d) => {
      process.stdout.write(d);
    });
  });

  req.on("error", (error) => {
    console.error("Error:", error);
  });

  req.write(postData);
  req.end();
}

async function run() {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({
    credential: cert(serviceAccount),
  });

  const db = getFirestore();
  const stopListener = db
    .collectionGroup("participants")
    .where("firstAttemptOn", ">", Timestamp.now())
    .onSnapshot(
      (querySnapshot) => {
        querySnapshot.docChanges().forEach((change) => {
          if (change.type == "added") {
            handleParticipantDoc(change.doc.data());
          }
        });
      },
      (error) => {
        console.error("Listener error:", error);
        triggerWorkflow();
        throw error;
      }
    );

  console.log("server running");
  await delay(WORKFLOW_DURATION);
  triggerWorkflow();
  await delay(TERMINATE_DELAY);
  stopListener();
}

run();
