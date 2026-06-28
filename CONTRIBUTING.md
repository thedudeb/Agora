# Contributing to Agora

Thanks for your interest in contributing. Agora is early, so thoughtful questions, product feedback, docs, design sketches, and implementation proposals are all useful.

## Ways to Help

- Review the PRD and suggest clearer scope.
- Open issues for missing workflows or unclear requirements.
- Help define the first implementation architecture.
- Improve documentation and onboarding.
- Contribute design explorations for core project views.
- Build focused features once the implementation stack is chosen.

## Contribution Principles

- Keep the product approachable for non-technical teams.
- Prefer clear workflows over maximum configurability.
- Protect self-hosting, data ownership, and exportability.
- Avoid adding broad workspace features until project management workflows are strong.
- Document product tradeoffs in issues or PRs.

## Before Opening a Pull Request

- Check whether an issue already exists.
- Keep changes focused.
- Explain the user problem and product behavior, not only the implementation.
- Update docs when behavior changes.
- Add tests when code exists and the change has meaningful behavior.

## Local Checks

Agora has no package dependencies right now. Copy the example environment file once:

```sh
cp .env.example .env
```

Use these commands before opening a PR:

```sh
npm run check
npm run test:api
```

For manual testing, run the app and API in separate terminals:

```sh
npm run dev
npm run dev:api
```

## Code of Conduct

Be direct, generous, and respectful. Assume good intent, make room for different experience levels, and keep discussion focused on making Agora better.
