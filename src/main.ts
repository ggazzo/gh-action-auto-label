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

    const originalLabels = response.data.map((label) => label.name);
    const tested = Boolean(originalLabels.includes('stat: QA tested'));
    const skipped = Boolean(originalLabels.includes('stat: QA skipped'));

    const labels: string[] = [
      ...new Set([...originalLabels, 'stat: needs QA', 'stat: ready to merge']),
    ].filter((label) => {
      if (label === 'stat: needs QA') {
        return !(skipped || tested);
      }

      if (label === 'stat: QA skipped') {
        return !tested && skipped;
      }

      if (label === 'stat: ready to merge') {
        return skipped || tested;
      }
      return true;
    });

    if (
      labels.every((label) => originalLabels.includes(label)) ||
      (config.ignore &&
        !response.data.some((label) => config.ignore.includes(label.name)))
    ) {
      core.info('Auto Label: nothing to do here');
      return;
    }

    core.info(
      `Auto Label: updating from ${originalLabels.join()} to ${labels.join()}`
    );

    await octokit.request(
      'PUT /repos/{owner}/{repo}/issues/{issue_number}/labels',
      {
        owner,
        repo,
        issue_number: Number(issue_number),
        labels,
      }
    );
  } catch (error) {
    error instanceof Error && core.setFailed(error.message);
  }
})();
