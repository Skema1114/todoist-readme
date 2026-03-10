const core = require("@actions/core");
const axios = require("axios");
const fs = require("fs");
const exec = require("./exec");

const TODOIST_API_KEY = core.getInput("TODOIST_API_KEY");

const README_FILE_PATH = "./README.md";

async function main() {
  try {
    const response = await axios.get("https://api.todoist.com/rest/v2/tasks", {
      headers: {
        Authorization: `Bearer ${TODOIST_API_KEY}`,
      },
    });

    const tasks = response.data || [];

    const stats = calculateStats(tasks);

    await updateReadme(stats);
  } catch (error) {
    console.error(error.response?.data || error.message);
    core.setFailed(error.message);
  }
}

function calculateStats(tasks) {
  const today = new Date().toISOString().slice(0, 10);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  let todayCount = 0;
  let weekCount = 0;

  tasks.forEach((task) => {
    if (!task.created_at) return;

    const date = task.created_at.slice(0, 10);

    if (date === today) {
      todayCount++;
    }

    if (new Date(date) >= weekAgo) {
      weekCount++;
    }
  });

  const total = tasks.length;

  const karma = total * 10;

  const streak = Math.min(total, 7);

  return {
    karma,
    todayCount,
    weekCount,
    total,
    streak,
  };
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
