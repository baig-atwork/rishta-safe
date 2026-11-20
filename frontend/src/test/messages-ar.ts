import core from "../messages/ar/core.json";
import marketing from "../messages/ar/marketing.json";
import result from "../messages/ar/result.json";
import consent from "../messages/ar/consent.json";
import closure from "../messages/ar/closure.json";
import clinical from "../messages/ar/clinical.json";
import oversight from "../messages/ar/oversight.json";

const messages: Record<string, unknown> = Object.assign({}, core, marketing, result, consent, closure, clinical, oversight);
export default messages;
