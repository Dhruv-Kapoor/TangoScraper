// 45 10 * * * /home/dhruv/.nvm/versions/node/v18.16.0/bin/node /home/dhruv/Desktop/crons/test_cron.js

async function notify(message) {
    console.log("Notifying", message);
  
    var https = require("https");
    var options = {
      host: "chat.googleapis.com",
      path: "/v1/spaces/AAQAMrX0-hg/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=AKgXL9o99myXaFXBXguzAtjBSMmPzhPtwiOVlnOw2w4",
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
    };
  
    const req = https.request(options, function (res) {});
    req.write(
      JSON.stringify({
        text: message,
      })
    );
    req.end();
  }
  
notify("test")
