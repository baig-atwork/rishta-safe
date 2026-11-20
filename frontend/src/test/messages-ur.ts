import core from "../messages/ur/core.json";
import marketing from "../messages/ur/marketing.json";
import result from "../messages/ur/result.json";
import consent from "../messages/ur/consent.json";
import closure from "../messages/ur/closure.json";
import clinical from "../messages/ur/clinical.json";
import oversight from "../messages/ur/oversight.json";

const messages: Record<string, unknown> = Object.assign({}, core, marketing, result, consent, closure, clinical, oversight);
export default messages;
