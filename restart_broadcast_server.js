const https = require("https");
const { resolve } = require("path");

const config = {
  pat: process.env.PAT,
  repository: "Dhruv-Kapoor/TangoScraper",
  workflowFile: "broadcast.yml",
  ref: "master",
  inputs: {},
};

function getRunningWorkflow() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${config.repository}/actions/runs`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.pat}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Node.js",
      },
    };

    const req = https.request(options, (response) => {
      // console.log(`Status Code: ${res.statusCode}`);
      let data = "";
      response.on("data", (chunk) => {
        data = data + chunk.toString();
      });

      response.on("end", () => {
        const body = JSON.parse(data);
        const workflows = body.workflow_runs.filter(
          (obj) =>
            obj.path.includes("broadcast.yml") && obj.status == "in_progress"
        );
        if (workflows.length > 0) {
          resolve(workflows[0]);
        } else {
          resolve(null);
        }
      });
    });

    req.on("error", (error) => {
      console.error("Error:", error);
    });

    req.end();
  });
}

function cancelWorkflow(workflow) {
  console.log(`cancelling workflow run id: ${workflow.id}`)
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${config.repository}/actions/runs/${workflow.id}/cancel`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.pat}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Node.js",
      },
    };

    const req = https.request(options, (res) => {
      console.log(`Status Code: ${res.statusCode}`);
      resolve()
      res.on("data", (d) => {
        process.stdout.write(d);
      });
    });

    req.on("error", (error) => {
      console.error("Error:", error);
    });

    req.end();
  });
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
  const workflow = await getRunningWorkflow();
  if (workflow) {
    await cancelWorkflow(workflow);
  }
  await triggerWorkflow();
}

run();
