import { Verb } from './verbs';

const MAX_AGGREGATED_ACTIVITIES_LENGTH = 15;

interface ActivityObject {
  id: number;
}

export class Activity {
  verb: ActivityObject;
  actor: ActivityObject;
  object: ActivityObject;
  target: ActivityObject | null;
  time: Date;
  extraContext: any;
  dehydrated: boolean;
  serializationId: number;

  constructor(
    actor: ActivityObject,
    verb: ActivityObject,
    object: ActivityObject,
    target: ActivityObject | null = null,
    time = null,
    extraContext = null
  ) {
    this.verb = verb;
    this.time = time || new Date();

    this.actor = typeof actor === 'number' ? null : actor;
    this.object = typeof object === 'number' ? null : object;
    this.target = typeof target === 'number' ? null : target;

    this.extraContext = extraContext || {};
    this.dehydrated = false;

    const milliseconds = this.time.getTime().toString();
    const paddedObjectId = this.object.id.toString().padStart(10, '0');
    const paddedVerbId = this.verb.id.toString().padStart(3, '0');
    const serializationIdStr = `${milliseconds}${paddedObjectId}${paddedVerbId}`;
    this.serializationId = Number.parseInt(serializationIdStr);
  }
}

export class AggregatedActivity {
  group: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  activities: Activity[];
  seenAt: Date | null = null;
  readAt: Date | null = null;
  minimizedActivities = 0;
  /*
    Object to store aggregated activities
  */
  constructor(
    group: string,
    activities: Activity[] = null,
    createdAt = null,
    updatedAt = null
  ) {
    this.group = group;
    this.activities = activities || [];
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // serializationId is used to keep items locally sorted and unique
  // (eg. used redis sorted sets' score or cassandra column names)
  // serializationId is also used to select random activities from the feed
  // (eg. remove activities from feeds must be fast operation)
  // for this reason the serializationId should be unique and not change over time
  // eg:
  // activity.serializationId = 1373266755000000000042008
  // 1373266755000 activity creation time as epoch with millisecond resolution
  // 0000000000042 activity left padded object.id (10 digits)
  // 008 left padded activity verb id (3 digits)
  // :returns: int --the serialization id
  getSerializationId = () => Math.round(this.updatedAt.getTime() / 100);

  // Returns a list of activity ids
  getActivityIds = () => this.activities.map(a => a.serializationId);

  // Checks if activity is present in this aggregated
  contains = (activity: Activity) =>
    this.activities.some(a => a.serializationId === activity.serializationId);

  append = (activity: Activity) => {
    if (this.contains(activity)) {
      return;
    }

    // append the activity
    this.activities.push(activity);

    //  set the first seen
    if (this.createdAt === null) {
      this.createdAt = activity.time;
    }

    //  set the last seen
    if (this.updatedAt === null || activity.time > this.updatedAt) {
      this.updatedAt = activity.time;
    }

    //  ensure that our memory usage, and pickling overhead don't go up
    //  endlessly
    if (this.activities.length > MAX_AGGREGATED_ACTIVITIES_LENGTH) {
      this.activities.shift();
      this.minimizedActivities += 1;
    }
  };

  remove = (activity: Activity) => {
    if (!this.contains(activity)) {
      return;
    }

    if (this.activities.length === 1) {
      throw new Error(
        'Removing this activity would leave an empty aggregation'
      );
    }

    const activityId = activity.serializationId || activity;
    this.activities = this.activities.filter(
      a => a.serializationId !== activityId
    );

    // now time to update the times
    this.updatedAt = this.getLastActivity().time;

    // adjust the count
    if (this.minimizedActivities) {
      this.minimizedActivities -= 1;
    }
  };

  removeMany = (activities: Activity[]) => {
    const removedActivites = [];
    activities.forEach(activity => {
      if (this.contains(activity)) {
        this.remove(activity);
        removedActivites.push(activity);
      }
    });

    return removedActivites;
  };

  // Returns a count of the number of actors
  // When dealing with large lists only approximate the number of actors
  getActorCount = () => this.minimizedActivities + this.getActorIds().length;

  getOtherActorCount = () => this.getActorCount() - 1;
  // Returns the number of activities
  getActivityCount = () => this.minimizedActivities + this.activities.length;

  getLastActivity = () => this.activities[this.activities.length - 1];

  getLastActivities = () => [...this.activities].reverse();

  getVerb = () => this.getVerbs()[0];

  getVerbs = (): Verb[] => {
    const seen = {};
    const verbs = [];
    this.activities.forEach(a => {
      if (seen[a.verb.id]) {
        return;
      }
      seen[a.verb.id] = true;
      verbs.push(a.verb);
    });

    return verbs;
  };

  getActorIds = (): string[] => {
    const seen = {};
    const actorIds = [];
    this.activities.forEach(a => {
      if (seen[a.actor.id]) {
        return;
      }
      seen[a.actor.id] = true;
      actorIds.push(a.actor.id);
    });

    return actorIds;
  };

  getObjectIds = (): string[] => {
    const seen = {};
    const object_ids = [];
    this.activities.forEach(a => {
      if (seen[a.object.id]) {
        return;
      }
      seen[a.object.id] = true;
      object_ids.push(a.object.id);
    });

    return object_ids;
  };

  // Returns if the activity should be considered as seen at this moment
  isSeen = () => this.seenAt !== null && this.seenAt >= this.updatedAt;
  // A hook method that updates the seenAt to current date
  updateSeenAt = () => {
    this.seenAt = new Date();
  };

  // Returns if the activity should be considered as seen at this moment
  isRead = () => this.readAt !== null && this.readAt >= this.updatedAt;
  // A hook method that updates the readAt to current date
  updateReadAt = () => {
    this.readAt = new Date();
  };
}
