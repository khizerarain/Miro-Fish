# GitHub App setup

Miro Fish can review pull requests with a simulated audience. On a PR it works out what a customer
would notice in the change, has your personas react, and posts a short summary comment plus a
neutral check run.

Everything it posts is labeled **simulated results**. It is a discussion aid, not user research,
and the check never fails a build.

---

## 1. Create the App

Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**
(or, for an org: **Org Settings → Developer settings → GitHub Apps**).

| Field | Value |
| --- | --- |
| **GitHub App name** | anything, e.g. `Miro Fish Reviews` |
| **Homepage URL** | your deployment URL, e.g. `https://mirofish.example.com` |
| **Webhook URL** | `https://<your-host>/api/github/webhook` |
| **Webhook secret** | a long random string — you'll paste it into `.env.local` |
| **Setup URL** | `https://<your-host>/api/github/setup` |

Tick **Redirect on update** next to the Setup URL.

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Repository permissions

| Permission | Access | Why |
| --- | --- | --- |
| **Contents** | Read-only | Read the diff |
| **Pull requests** | Read-only | Read PR metadata and files |
| **Issues** | Read & write | PR comments are issue comments in GitHub's API |
| **Checks** | Read & write | Publish the neutral check run |
| **Metadata** | Read-only | Always required |

Nothing else. No write access to code, no access to Actions or secrets.

### Subscribe to events

- **Pull request**
- **Installation**
- **Installation repositories**

### Where can it be installed?

Your choice. "Any account" is easiest for testing on a personal repo.

---

## 2. Configure the app

In the App's settings page:

1. **Generate a private key** → downloads a `.pem` file.
2. Copy the **App ID** from the top of the page.
3. Note the **App slug** from the public URL: `https://github.com/apps/<slug>`.

Add to `.env.local` (or your host's environment):

```bash
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
GITHUB_WEBHOOK_SECRET=the-secret-you-typed-above
GITHUB_APP_SLUG=miro-fish-reviews
```

The private key can be pasted as one line with `\n` between the header, each line of the key, and
the footer. Both `\n` and `\\n` are accepted; the loader normalises them. Keep the `BEGIN` and `END`
lines.

Without all three of `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` and `GITHUB_WEBHOOK_SECRET` the
integration stays inert: the webhook answers `503` and nothing is posted.

Restart the server after changing env vars.

---

## 3. Install and connect an audience

1. Open **GitHub** in the sidebar → **Install on a repository**.
2. Pick the repositories. GitHub redirects to `/api/github/setup`, which links the installation to
   the Miro Fish account you're signed in as.
3. Back on the **GitHub** page, choose an **audience** for each repository.

The audience must already have personas. If it doesn't, the PR gets a short note saying so instead
of a simulation.

---

## 4. Try it

Open a pull request against a connected repository. Within a few seconds you should see:

- a check run named **Simulated customer reaction**, and
- one comment, updated in place on later pushes.

To test the plumbing without GitHub, from a terminal:

```bash
# 1. Start the app
npm run dev

# 2. In another terminal, send a signed ping
node -e "
const {createHmac}=require('crypto');
const body=JSON.stringify({zen:'test'});
const sig='sha256='+createHmac('sha256',process.env.GITHUB_WEBHOOK_SECRET||'YOUR_SECRET').update(body).digest('hex');
fetch('http://localhost:3000/api/github/webhook',{method:'POST',headers:{
  'content-type':'application/json','x-github-event':'ping',
  'x-hub-signature-256':sig,'x-github-delivery':'local-'+Date.now()
},body}).then(async r=>console.log(r.status, await r.text()));
"
```

A `401` means the secret doesn't match. A `200` with `{"pong":true}` means the endpoint is alive.

---

## Behaviour notes

**It stays quiet when nothing changed for customers.** Diffs that only touch tests, CI, lockfiles,
docs or formatting are classified `internal_only` and produce no comment — just a passing check
run. This is deliberate: a bot that comments on every PR gets muted.

**One comment per PR.** The comment body carries an HTML marker, so pushes update it rather than
starting a new thread.

**Drafts are skipped** until marked ready. Merged and closed PRs are ignored.

**Re-run** from the GitHub page re-reads the diff and starts a fresh simulation.

**Numbers come from stored reactions.** The comment's counts, means and percentages are computed in
code from the reaction rows; the model only writes prose around them.

**The check is always `neutral`** (or `success` for an internal-only change). It cannot block a
merge, because a simulation is not a test.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Webhook returns `503` | One of the three env vars is missing. |
| Webhook returns `401` | `GITHUB_WEBHOOK_SECRET` doesn't match the one in the App settings. |
| Comment says it couldn't run | No audience connected, or the audience has no personas. |
| `GITHUB_APP_PRIVATE_KEY could not be read as a PEM` | The key lost its `BEGIN`/`END` lines or its newlines were mangled. Re-paste it. |
| Nothing happens at all | The webhook URL must be publicly reachable. In development use a tunnel (`ngrok http 3000`) and point the App at the tunnel URL. |
| `POST /api/github/webhook 202` but no comment | Check the server log for `{"evt":"github",...}` lines — they name the ignored reason. |

Webhook deliveries are recorded in `github_deliveries`, so a redelivery is never processed twice.
You can redeliver from **App settings → Advanced → Recent Deliveries** and it will be ignored if
already handled; delete the row to force a reprocess.

---

## Verifying without GitHub

Two scripts exercise the integration offline (`MOCK_LLM=true`, no API keys needed):

```bash
npx tsx --import ./scripts/no-server-only.mjs scripts/verify-github.ts    # signature, parsing, comment rendering, real simulation
npx tsx --import ./scripts/no-server-only.mjs scripts/verify-pipeline.ts  # full state machine with GitHub stubbed
```

Stop `npm run dev` first: the embedded PGlite database is single-process.
