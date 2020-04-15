// Every activity has a verb and an object.
// Nomenclatura is loosly based on
// http://activitystrea.ms/specs/atom/1.0/#activity.summary
export interface Verb {
  id: number;
  infinitive: string;
  pastTense: string;
}

const follow: Verb = {
  id: 1,
  infinitive: 'follow',
  pastTense: 'followed'
};

const comment: Verb = {
  id: 2,
  infinitive: 'comment',
  pastTense: 'commented'
};

const love: Verb = {
  id: 3,
  infinitive: 'love',
  pastTense: 'loved'
};

const add: Verb = {
  id: 4,
  infinitive: 'add',
  pastTense: 'added'
};

const verbs = {
  [follow.id]: follow,
  [comment.id]: comment,
  [love.id]: love,
  [add.id]: add
};

export default verbs;
