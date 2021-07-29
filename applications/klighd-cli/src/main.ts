/*
 * KIELER - Kiel Integrated Environment for Layout Eclipse RichClient
 *
 * http://rtsys.informatik.uni-kiel.de/kieler
 *
 * Copyright 2021 by
 * + Kiel University
 *   + Department of Computer Science
 *     + Real-Time and Embedded Systems Group
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 */

import "reflect-metadata";
import "./styles/main.css";
import "@kieler/klighd-core/styles/main.css";
import {
    createKlighdDiagramContainer,
    requestModel,
    getActionDispatcher,
    SetPreferencesAction,
    bindServices,
    SetInitialBookmark,
} from "@kieler/klighd-core";
import { LSPConnection } from "./services/connection";
import { getBookmarkViewport, getDiagramSourceUri, getLanguageId, readSearchParam, sleep } from "./helpers";
import { showSpinner, hideSpinner } from "./spinner";
import { showPopup } from "./popup";
import { Bookmark } from "../../../packages/klighd-core/lib/bookmarks/bookmark";

// IIFE booting the application
(async function main() {
    const sourceUri = getDiagramSourceUri();

    if (!sourceUri) {
        showPopup(
            "warn",
            "Wrong usage",
            "Please specify a file URI to your diagram as a search parameter. (?source=...)",
            { persist: true }
        );
        return;
    }

    try {
        showSpinner("Initializing connection...");
        await initDiagramView(sourceUri);
        hideSpinner();
    } catch (e) {
        console.error(e);
        showPopup(
            "error",
            "Initialization error",
            "Something went wrong while initializing the diagram. Please reload and try again."
        );
    }
})();

/**
 * Opens a connection to the LS, prepares the `klighd-core` view and start a
 * visualization by dispatching a model request.
 * @see `klighd-core` for more getting started information.
 */
async function initDiagramView(sourceUri: string) {
    const languageId = getLanguageId(sourceUri);
    const socketUrl = `ws://${location.host}/socket`;

    const connection = new LSPConnection();
    const diagramContainer = createKlighdDiagramContainer("sprotty");
    bindServices(diagramContainer, { connection, sessionStorage });
    const actionDispatcher = getActionDispatcher(diagramContainer);

    sendUrlSearchParamPreferences(actionDispatcher);
    setInitialBookmark(actionDispatcher)

    // Connect to a language server and request a diagram.
    await connection.connect(socketUrl);
    await connection.sendInitialize();
    connection.sendDocumentDidOpen(sourceUri, languageId);
    // If this does not sleep for bit, the LS send two requestTextBounds and updateOptions actions.
    // Properly because the document changes, when the server still reads the document from "openDocument".
    // There is no way to await a sent notification in the vscode-languageclient api, so we can not wait until
    // the document is opened.
    // This tries to find a sweet-spot between not sacrificing user experience and
    // giving the server an opportunity to fully read the file before a model is requested.
    await sleep(500);
    await requestModel(actionDispatcher, sourceUri);

}

/** Communicates preferences to the diagram container which are read from the url search params. */
function sendUrlSearchParamPreferences(actionDispatcher: ReturnType<typeof getActionDispatcher>) {
    actionDispatcher.dispatch(
        new SetPreferencesAction({
            resizeToFit: readSearchParam("resizeToFit") === "false" ? false : true,
        })
    );
}

/** Set an initial Position based on the bookmark Parameters. */
function setInitialBookmark(actionDispatcher: ReturnType<typeof getActionDispatcher>) {
    const viewport = getBookmarkViewport();
    if (viewport) {
        actionDispatcher.dispatch(
            new SetInitialBookmark(new Bookmark(viewport, "From URI"))
        );
    }
}