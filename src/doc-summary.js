/**
 * Layer 2 (TypeScript) — every exported symbol, and every public member of one, carries a TSDoc
 * summary wherever the code travels.
 *
 * A doc comment on exported code is the documentation a package carries inside itself: the
 * compiler keeps it in the `.d.ts` it emits, and a consumer's editor shows it over a call long
 * after `docs/` was left behind. `eslint.base.js` turns the rule on under `src/`, which is where
 * that code lives; a test is documented by its name and never leaves its repository.
 *
 * A public member is a method, a constructor, a property, an accessor, a constructor parameter
 * that declares a property, an enum member, and the named members of an exported interface or
 * object type. An override is a member like any other: `{@inheritDoc}` is how it says that it
 * adds nothing to what it overrides.
 *
 * What it can ask is that a summary exists: the doc comment's first text is prose, not a tag.
 * `@returns` alone documents what the signature already states, and whether a summary says the
 * right thing is not something a rule can read.
 *
 * It reads the declaration the `export` keyword is written on. One exported later by name — in an
 * `export { a }` list, or as `export default a` — is not followed.
 */

import { AST_NODE_TYPES, AST_TOKEN_TYPES } from '@typescript-eslint/utils';

/** @import { TSESLint, TSESTree } from '@typescript-eslint/utils' */

/**
 * Whether a run of comments ends in a doc comment with a summary: a `/**` block whose first
 * character that is neither whitespace nor an asterisk is anything but `@`.
 *
 * @param {TSESTree.Comment[]} comments the comments written just before what they document
 * @returns {boolean}
 */
function summarised(comments) {
    const doc = comments.findLast(
        (comment) => comment.type === AST_TOKEN_TYPES.Block && comment.value.startsWith('*'),
    );
    const first = doc?.value.replace(/[\s*]/gu, '')[0];

    return first !== undefined && first !== '@';
}

/**
 * A key's name as a reader would write it.
 *
 * @param {TSESTree.Node} id
 * @param {TSESLint.SourceCode} sourceCode
 * @returns {string}
 */
function nameOf(id, sourceCode) {
    return id.type === AST_NODE_TYPES.Identifier ? id.name : sourceCode.getText(id);
}

/**
 * What a declaration is called in a report: its name, the names of the variables it declares, or
 * `default` for a default export that has none.
 *
 * @param {TSESTree.Node} declaration
 * @param {TSESLint.SourceCode} sourceCode
 * @returns {string}
 */
function labelOf(declaration, sourceCode) {
    if (declaration.type === AST_NODE_TYPES.VariableDeclaration) {
        return declaration.declarations
            .map((declarator) => nameOf(declarator.id, sourceCode))
            .join(', ');
    }

    return 'id' in declaration && declaration.id ? nameOf(declaration.id, sourceCode) : 'default';
}

/**
 * The public members of a declaration, each with the name a report gives it, in the order they
 * are written.
 *
 * @param {TSESTree.Node} declaration
 * @param {string} owner
 * @param {TSESLint.SourceCode} sourceCode
 * @returns {Array<[string, TSESTree.Node]>}
 */
function membersOf(declaration, owner, sourceCode) {
    /** @type {Array<[string, TSESTree.Node]>} */
    const found = [];

    if (declaration.type === AST_NODE_TYPES.TSEnumDeclaration) {
        for (const member of declaration.body.members) {
            found.push([`${owner}.${nameOf(member.id, sourceCode)}`, member]);
        }

        return found;
    }

    /** @type {TSESTree.Node[]} */
    let body = [];

    if (
        declaration.type === AST_NODE_TYPES.ClassDeclaration ||
        declaration.type === AST_NODE_TYPES.ClassExpression
    ) {
        body = declaration.body.body;
    } else if (declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
        body = declaration.body.body;
    } else if (
        declaration.type === AST_NODE_TYPES.TSTypeAliasDeclaration &&
        declaration.typeAnnotation.type === AST_NODE_TYPES.TSTypeLiteral
    ) {
        body = declaration.typeAnnotation.members;
    }

    for (const member of body) {
        // A member is named when it has a key; a static block, an index signature and a call
        // signature have none, and nobody reaches them by name.
        if (!('key' in member)) {
            continue;
        }

        if (isPublic(member)) {
            const called =
                'kind' in member && (member.kind === 'method' || member.kind === 'constructor');
            found.push([`${owner}.${nameOf(member.key, sourceCode)}${called ? '()' : ''}`, member]);
        }

        // A constructor parameter with a modifier declares a property, public unless it says
        // otherwise, whatever the constructor's own visibility. Only a constructor's parameters
        // can, so any method's are read.
        if (member.type === AST_NODE_TYPES.MethodDefinition) {
            for (const parameter of member.value.params) {
                if (parameter.type === AST_NODE_TYPES.TSParameterProperty && isPublic(parameter)) {
                    const property =
                        parameter.parameter.type === AST_NODE_TYPES.AssignmentPattern
                            ? parameter.parameter.left
                            : parameter.parameter;
                    found.push([`${owner}.${nameOf(property, sourceCode)}`, parameter]);
                }
            }
        }
    }

    return found;
}

/**
 * Whether a member is reachable from outside: not `private`, not `protected`, not a `#name`.
 *
 * @param {TSESTree.Node} member
 * @returns {boolean}
 */
function isPublic(member) {
    const accessibility = 'accessibility' in member ? member.accessibility : undefined;
    const privateName = 'key' in member && member.key.type === AST_NODE_TYPES.PrivateIdentifier;

    return accessibility !== 'private' && accessibility !== 'protected' && !privateName;
}

/**
 * The rule. Registered by `eslint.base.js` as `@rak200/coding-standard-ts/doc-summary`, and
 * turned on under `src/`.
 *
 * @type {TSESLint.RuleModule<'missing'>}
 */
export default {
    // ESLint reads `meta.defaultOptions`, never this one; the type asks for it.
    // Stryker disable next-line ArrayDeclaration: nothing reads it, so no mutant shows
    defaultOptions: [],
    meta: {
        // ESLint reads `type` only to filter fixes, and this rule has none.
        // Stryker disable next-line StringLiteral: nothing reads it, so no mutant shows
        type: 'suggestion',
        messages: { missing: '{{name}} has no TSDoc summary.' },
        schema: [],
    },
    create(context) {
        const sourceCode = context.sourceCode;

        /**
         * Reports an exported declaration without a summary, and each public member of it.
         *
         * @param {TSESTree.ExportNamedDeclaration | TSESTree.ExportDefaultDeclaration} statement
         * @param {TSESTree.Node} declaration
         */
        function check(statement, declaration) {
            // A decorator written before `export` sits outside the statement, and the doc
            // comment sits before the decorator.
            const decorators = 'decorators' in declaration ? declaration.decorators : [];
            const start = Math.min(
                statement.range[0],
                ...decorators.map((decorator) => decorator.range[0]),
            );
            const label = labelOf(declaration, sourceCode);

            if (
                !summarised(
                    sourceCode.getCommentsBefore(
                        /** @type {TSESTree.Token} */ (sourceCode.getTokenByRangeStart(start)),
                    ),
                )
            ) {
                context.report({ node: statement, messageId: 'missing', data: { name: label } });
            }

            for (const [name, member] of membersOf(declaration, label, sourceCode)) {
                if (!summarised(sourceCode.getCommentsBefore(member))) {
                    context.report({ node: member, messageId: 'missing', data: { name } });
                }
            }
        }

        return {
            ExportNamedDeclaration(statement) {
                if (statement.declaration) {
                    check(statement, statement.declaration);
                }
            },
            ExportDefaultDeclaration(statement) {
                if (statement.declaration.type !== AST_NODE_TYPES.Identifier) {
                    check(statement, statement.declaration);
                }
            },
        };
    },
};
