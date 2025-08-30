# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### game play instruction
This is an English version of the Japanese game Shiritori.

First, player one is given a random letter and must pick a word beginning with that letter.

Then players take turns with the last letter of each word becoming the start of the next word.

Additionally, words must

Be in the dictionary (no proper nouns, see FAQ)
Have at least 4 letters
Have not been used before
Players score more for longer words and for answering quickly.

Length bonus: Number of letters minus 4
Speed bonus: Number of seconds remaining
The first player to get their score down to zero is the winner
