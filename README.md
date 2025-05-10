# Tango Scraper
Scraping project for linkedin games and backend for <a href="https://github.com/Dhruv-Kapoor/Tango">Tango android application</a>.
- Uses puppeteer to open linkedin puzzles and retrieve html for the page.
- This html is then converted to a json array and uploaded on firestore.
- Triggers notifications to subscribed users in the application notifying about new levels.
- Android application acts as the client for this firestore and players can play these puzzles.
- Automatically runs everyday at designated time using github actions scheduling options.
- Runs broadcast server to handle to notify players when someone completes daily challenge.
