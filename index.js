const core = require("@actions/core");
const axios = require("axios");
const fs = require("fs");
const exec = require("./exec");

const TODOIST_API_KEY = core.getInput("TODOIST_API_KEY");

const README_FILE_PATH = "./README.md";

async function main() {
  try {
    const headers = { Authorization: `Bearer ${TODOIST_API_KEY}` };

    const statsResponse = await axios.get("https://api.todoist.com/api/v1/user/stats", { headers });
    const data = statsResponse.data;

    console.log("Stats response:", JSON.stringify(data, null, 2));

    const karma = data.karma || 0;
    const todayCount = data.days_items?.[0]?.total_completed || 0;
    const weekCount = data.week_items?.[0]?.total_completed || 0;
    const total = data.completed_count || 0;
    const streak = data.goals?.current_daily_streak?.count || 0;

    await updateReadme({ karma, todayCount, weekCount, total, streak });
  } catch (error) {
    console.error(error.response?.data || error.message);
    core.setFailed(error.message);
  }
}

async function updateReadme(stats) {
  const { karma, todayCount, weekCount, total, streak } = stats;

  const content = `

<img src="https://media.giphy.com/media/pLdVWrcyYuDbA1gzRC/giphy.gif" width="20"> Possuo **${karma}** pontos de Karma;           
<img src="https://media.giphy.com/media/toPQKsvkZn12WROprz/giphy.gif" width="20"> Completei **${todayCount}** tarefas hoje;           
<img src="https://media.giphy.com/media/iVytKHg54kvEbSOyJe/giphy.gif" width="20"> Completei **${weekCount}** tarefas essa semana;           
<img src="https://media.giphy.com/media/fLfIiS0UhOh2ruaX0m/giphy.gif" width="20"> Completei **${total}** tarefas no total;           
<img src="https://media.giphy.com/media/2iktjYc84MxU9Izzfb/giphy.gif" width="20"> Sequência mais longa é de **${streak}** dias;

`;

  const readme = fs.readFileSync(README_FILE_PATH, "utf8");

  const start = "<!-- TODO-IST:START -->";
  const end = "<!-- TODO-IST:END -->";

  const newReadme = readme.replace(new RegExp(`${start}[\\s\\S]*${end}`), `${start}\n${content}\n${end}`);

  fs.writeFileSync(README_FILE_PATH, newReadme);

  await commitReadme();
}

async function commitReadme() {
  const committerUsername = "github-actions";
  const committerEmail = "github-actions@github.com";

  await exec("git", ["config", "--global", "user.email", committerEmail]);
  await exec("git", ["config", "--global", "user.name", committerUsername]);

  await exec("git", ["add", "README.md"]);
  await exec("git", ["commit", "-m", "Todoist stats updated"]);
  await exec("git", ["push"]);
}

main();
