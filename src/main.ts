import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/action';
import minimatch from 'minimatch';

const { GITHUB_REPOSITORY = '', GITHUB_REF = '' } = process.env;

const [owner, repo] = GITHUB_REPOSITORY.split('/');
const issue_number = GITHUB_REF.split('/')[2];
const configPath = core.getInput('configuration-path');

const octokit = new Octokit();

(async () => {
  try {
    const response = await octokit.request(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/labels',
      {
        owner,
        repo,
        issue_number: Number(issue_number),
      }
    );

    if (
      !response.data.some((label) => {
        if (label.name === 'stat: needs QA') {
          return true;
        }

        if (label.name === 'stat: QA skipped') {
          return true;
        }
      })
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
