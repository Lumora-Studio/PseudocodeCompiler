const {
  createRunOncePlugin,
  withAppDelegate,
} = require("@expo/config-plugins");
const {
  mergeContents,
  removeContents,
} = require("@expo/config-plugins/build/utils/generateCode");

const IMPORT_TAG = "igcse-ios-pointer-events-import";
const INIT_TAG = "igcse-ios-pointer-events-init";
const HAS_REACT_IMPORT = /^\s*import React\s*$/m;
const REACT_BOOTSTRAP = /^\s*let delegate = ReactNativeDelegate\(\)\s*$/m;

function addPointerEventImport(src) {
  const cleaned = removePointerEventImport(src);
  if (HAS_REACT_IMPORT.test(cleaned.contents)) {
    return cleaned;
  }

  return mergeContents({
    tag: IMPORT_TAG,
    src: cleaned.contents,
    newSrc: "import React",
    anchor: /(@main|@UIApplicationMain)/,
    offset: 0,
    comment: "//",
  });
}

function removePointerEventImport(src) {
  return removeContents({
    tag: IMPORT_TAG,
    src,
  });
}

function addPointerEventInit(src) {
  return mergeContents({
    tag: INIT_TAG,
    src,
    newSrc: "RCTSetDispatchW3CPointerEvents(true)",
    anchor: REACT_BOOTSTRAP,
    offset: 0,
    comment: "//",
  });
}

function removePointerEventInit(src) {
  return removeContents({
    tag: INIT_TAG,
    src,
  });
}

const withIosPointerEvents = (config) => {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== "swift") {
      throw new Error(
        `Cannot enable iOS pointer events because AppDelegate is not Swift: ${config.modResults.language}`,
      );
    }

    try {
      config.modResults.contents = addPointerEventImport(
        config.modResults.contents,
      ).contents;
      config.modResults.contents = addPointerEventInit(
        config.modResults.contents,
      ).contents;
    } catch (error) {
      if (error.code === "ERR_NO_MATCH") {
        config.modResults.contents = removePointerEventImport(
          config.modResults.contents,
        ).contents;
        config.modResults.contents = removePointerEventInit(
          config.modResults.contents,
        ).contents;

        throw new Error(
          "Cannot enable iOS pointer events because the generated AppDelegate shape was not recognized.",
        );
      }
      throw error;
    }

    return config;
  });
};

module.exports = createRunOncePlugin(
  withIosPointerEvents,
  "with-ios-pointer-events",
  "1.0.0",
);
