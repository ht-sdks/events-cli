# Releasing

This package follows semantic versioning. Publishing a GitHub Release publishes `@ht-sdks/events-cli` to npm.

1. Make sure `main` is the commit you want to ship (CI green).
2. Create a GitHub Release whose tag is `vX.Y.Z` (for example `v0.1.0`).
   - From the GitHub UI: **Releases → Draft a new release**, tag `vX.Y.Z` on `main`, then **Publish release**.
   - Or from the CLI:

     ```sh
     git tag vX.Y.Z
     git push origin vX.Y.Z
     gh release create vX.Y.Z --generate-notes
     ```

The [Publish to npm](.github/workflows/publish.yml) workflow sets `package.json` version from that tag and runs `npm publish --access=public`. You do not need to bump the version in git first.

Bumping `"version"` in `package.json` on `main` is optional. Do it for a new **major** so the repo documents which major the code represents. The published package always uses the version parsed from the release tag.

Do not publish a GitHub Release until you intend that version to go to npm `latest`. Drafts do not publish; publishing the release does.
