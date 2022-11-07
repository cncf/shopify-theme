# Custom Shopify Theme for CNCF Merchandise Store

Based on [Dawn Theme](https://github.com/Shopify/dawn) from Shopify.

Updates to this repo are automatically pulled in and deployed to the CNCF Shopify store.

## Editing

We recommend using VS Code. There are several recommended extensions in ```/.vscode/extensions.json``` which should be suggested for your use when opening this project.

## Staying up to date with Dawn changes

To pull in the latest changes and updates to Dawn, you can add a remote `upstream` pointing to the Dawn repository.

1. Add an `upstream` remote that points to Shopify's Dawn repository:
```sh
git remote add upstream https://github.com/Shopify/dawn.git
```
2. Create a new branch i.e. updates.

3. Pull in the latest Dawn changes into your repository:
```sh
git fetch upstream
git pull upstream main
```

### Theme Check

You can run it from a terminal with the following Shopify CLI command:

```bash
shopify theme check
```
