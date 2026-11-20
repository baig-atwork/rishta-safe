import core from "../messages/en/core.json";
import marketing from "../messages/en/marketing.json";
import result from "../messages/en/result.json";
import consent from "../messages/en/consent.json";
import closure from "../messages/en/closure.json";
import clinical from "../messages/en/clinical.json";
import oversight from "../messages/en/oversight.json";

const messages: Record<string, unknown> = Object.assign({}, core, marketing, result, consent, closure, clinical, oversight);
export default messages;
