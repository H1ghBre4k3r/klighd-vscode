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
 * This code is provided under the terms of the Eclipse Public License (EPL).
 */

import "reflect-metadata";
import "./styles/main.css";
import {
    Connection,
    createKeithDiagramContainer,
    requestModel,
    SessionStorage,
} from "@kieler/keith-sprotty";
import { LSPConnection } from "./services/connection";
import { getDiagramSourceUri, getLanguageId, sleep } from "./helpers";
import { showSpinner, hideSpinner } from "./spinner";
import { IActionDispatcher, TYPES } from "sprotty";
import { showPopup } from "./popup";

// IIFE booting the application
(async function main() {
    const sourceUri = getDiagramSourceUri();

    if (!sourceUri) {
        showPopup(
            "warn",
            "Wrong usage",
            "Please specify a fileUri for your diagram as a search parameter. (?source=...)",
            { persist: true }
        );
        return;
    }

    try {
        showSpinner();
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

async function initDiagramView(sourceUri: string) {
    const languageId = getLanguageId(sourceUri);
    const socketUrl = `ws://${location.host}/socket`;

    const connection = new LSPConnection();
    const diagramContainer = createKeithDiagramContainer("sprotty");
    diagramContainer.bind(Connection).toConstantValue(connection);
    diagramContainer.bind(SessionStorage).toConstantValue(sessionStorage);
    const actionDispatcher = diagramContainer.get<IActionDispatcher>(TYPES.IActionDispatcher);

    // Connect to a language server and request a diagram.
    await connection.connect(socketUrl);
    await connection.sendInitialize();
    connection.sendDocumentDidOpen(sourceUri, languageId);
    // TODO: If this does not sleep, the LS send two requestTextBounds and updateOptions actions...
    await sleep(200);
    await requestModel(actionDispatcher, { sourceUri, diagramType: "keith-diagram" });
}
