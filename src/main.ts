import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/action';

const { GITHUB_REPOSITORY = '', GITHUB_REF = '' } = process.env;

const [owner, repo] = GITHUB_REPOSITORY.split('/');
const issue_number = GITHUB_REF.split('/')[2];
const configPath = core.getInput('configuration-path');

const octokit = new Octokit();

async function getJSON(repoPath: string) {
  const response = await octokit.repos.getContent({
    owner,
    repo,
    path: repoPath,
    ref: github.context.sha,
  });

  return JSON.parse(
    Buffer.from(
      (response.data as any).content,
      (response.data as any).encoding
    ).toString()
  );
}

(async () => {
  try {
    const config = (await getJSON(configPath)) as {
      ignore: string[];
    };

    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/labels',
      {
        owner,
        repo,
        issue_number: Number(issue_number),
      }
    );

    if (
      config.ignore &&
      !response.data.some((label) => config.ignore.includes(label.name))
    ) {
      core.info('Auto Label: nothing to do here');
    }

    await octokit.request(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/labels',
      {
        owner,
        repo,
        issue_number: Number(issue_number),
        labels: ['stat: needs QA'],
      }
    );
  } catch (error) {
    error instanceof Error && core.setFailed(error.message);
  }
})();
