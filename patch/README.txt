THE PATCH — website folder (app v1.2.57)

WHERE IT GOES
Upload this whole "patch" folder to the top of your v3ktor.org site, so the addresses are:
  www.v3ktor.org/patch/       ← the page (explains it, install steps, EN/FR)
  www.v3ktor.org/patch/app/   ← the app itself (installable, works offline)
Any other folder name works too — every link inside is relative.

WHAT'S INSIDE
  index.html                 the page
  img/                       app screenshots for the page (EN and FR)
  app/index.html             the app (same as the Acode file, plus install + offline code)
  app/manifest.webmanifest   name, icon and colours the phone uses when installing
  app/sw.js                  offline cache
  app/icons/                 app icon in every size phones ask for

MUST-HAVES ON THE HOST
1. HTTPS. Phones refuse to install a web app over plain http.
2. If Android shows no "Install" option: make sure the host serves .webmanifest files as
   "application/manifest+json" (most hosts already do).
3. Don't let the host cache sw.js for long (most don't). It's how phones learn there's a new version.

UPDATING LATER
When there's a new app version, re-upload the app/ folder (and img/ if screenshots changed).
Installed phones pick up the new version the next time they open the app with a connection.

PEOPLE'S DATA
It stays in each phone's browser storage for www.v3ktor.org — nothing is sent anywhere.
Moving from the Claude or Acode copy: old copy → menu ☰ → "Back up my data",
new installed app → menu ☰ → "Restore from a backup".

LICENSE
The Patch is free software under the GNU Affero General Public License, version 3 or later
(the LICENSE file at the top of the repository). Copying and changing it is fine: keep the LICENSE
file and the notice at the top of app/index.html. If you put a changed copy online for other
people, share your changes under the same license. Source: https://github.com/tobiedavid/v3ktor.org
Two extra terms (section 7 of the license): every copy keeps the line "Made by Tobie and Claude.
Free version at v3ktor.org/patch." (or the French one) in its About screen, and a changed version
can't be presented as the original. The full wording is in the notice at the top of app/index.html.
