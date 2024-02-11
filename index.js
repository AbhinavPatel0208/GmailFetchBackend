const { google } = require('googleapis');
const express = require('express');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config(); 

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';
const app = express();
const PORT = 3000;

const { CLIENT_SECRET, CLIENT_ID } = process.env;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'http://localhost:3000/auth/google/callback');

fs.readFile('token.json', (err, token) => {
    if (err) return getNewToken(oAuth2Client, listLast200Emails);
    oAuth2Client.setCredentials(JSON.parse(token));
    listLast200Emails(oAuth2Client);
});

function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error while trying to retrieve access token', err);
            oAuth2Client.setCredentials(token);
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

function listLast200Emails(auth) {
    const gmail = google.gmail({ version: 'v1', auth });
    gmail.users.messages.list({
        userId: 'me',
        maxResults: 200,
        labelIds: ['INBOX'],
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const messages = res.data.messages;
        if (messages.length) {
            let emails = [];
            let processedMessages = 0;
            messages.forEach((message) => {
                gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'metadata',
                    metadataHeaders: ['From', 'Subject'],
                }, (err, res) => {
                    if (err) {
                        console.log('Error retrieving message:', err);
                    } else {
                        const headers = res.data.payload.headers;
                        const subjectHeader = headers.find(header => header.name === 'Subject');
                        const fromHeader = headers.find(header => header.name === 'From');
                        emails.push({
                            from: fromHeader.value,
                            subject: subjectHeader.value
                        });
                    }
                    processedMessages++;
                    if (processedMessages === messages.length) {
                        serveEmails(emails);
                    }
                });
            });
        } else {
            console.log('No messages found.');
        }
    });
}

function serveEmails(emails) {
    app.get('/', (req, res) => {
        let html = '<h1>Last 200 Emails</h1><ul>';
        emails.forEach(email => {
            html += `<li><strong>From:</strong> ${email.from} <br><strong>Subject:</strong> ${email.subject}</li>`;
        });
        html += '</ul>';
        res.send(html);
    });

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}
