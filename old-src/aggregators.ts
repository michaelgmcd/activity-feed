// from stream_framework.activity import AggregatedActivity, Activity
// from copy import deepcopy
// from stream_framework.exceptions import DuplicateActivityException
import { Activity, AggregatedActivity } from './activity';

// Aggregators implement the combining of multiple activities into aggregated activities.
// The two most important methods are aggregate and merge:
//   Aggregate takes a list of activities and turns it into a list of aggregated activities
//   Merge takes two lists of aggregated activities and returns a list of new and changed aggregated activities
class BaseAggregator {
  aggregated_activity_class = AggregatedActivity;
  activity_class = Activity;

  // :param activties: A list of activities
  // :returns list: A list of aggregated activities

  // Runs the group activities (using get group)
  // Ranks them using the giving ranking function
  // And returns the sorted activities

  // **Example** ::

  //     aggregator = ModulusAggregator()
  //     activities = [Activity(1), Activity(2)]
  //     aggregated_activities = aggregator.aggregate(activities)
  aggregate = (activities: Activity[]) => {
    const aggregated = this.groupActivities(activities);
    const aggregated_activities: AggregatedActivity[] = Object.values(
      aggregated
    );
    const ranked_aggregates = this.rank(aggregated_activities);

    return ranked_aggregates;
  };

  // :param aggregated: A list of aggregated activities
  // :param activities: A list of the new activities
  // :returns tuple: Returns new, changed

  // Merges two lists of aggregated activities and returns the new aggregated
  // activities and a from, to mapping of the changed aggregated activities

  // **Example** ::

  //     aggregator = ModulusAggregator()
  //     activities = [Activity(1), Activity(2)]
  //     aggregated_activities = aggregator.aggregate(activities)
  //     activities = [Activity(3), Activity(4)]
  //     new, changed = aggregator.merge(aggregated_activities, activities)
  //     for activity in new:
  //         print activity

  //     for from, to in changed:
  //         print 'changed from %s to %s' % (from, to)
  merge = (aggregated: AggregatedActivity[], activities: Activity[]) => {
    const currentActivities = {};

    aggregated.forEach(agg => {
      currentActivities[agg.group] = agg;
    });

    const newAggs = [];
    const changed = [];
    const newAggregated = this.aggregate(activities);
    newAggregated.forEach(agg => {
      if (!currentActivities[agg.group]) {
        newAggs.push(agg);
      } else {
        const current_aggregated = currentActivities[agg.group];
        const newAggregated = { ...current_aggregated };
        agg.activities.forEach(activity => {
          if (!newAggregated.includes(newAggregated)) {
            newAggregated.push(activity);
          }
        });
        if (current_aggregated.activities !== newAggregated.activities) {
          changed.push([current_aggregated, newAggregated]);
        }
      }
    });

    return { newAggs, changed };
  };

  // Groups the activities based on their group
  // Found by running getGroup(actvity on them)
  groupActivities = (unsortedActivities: Activity[]) => {
    const aggregated: { [group: string]: AggregatedActivity } = {};
    // make sure that if we aggregated multiple activities
    // they end up in serialization_id desc in the aggregated activity
    const activities = [...unsortedActivities];
    activities.sort();
    activities.forEach(activity => {
      const group = this.getGroup(activity);
      if (!aggregated[group]) {
        aggregated[group] = new AggregatedActivity(group);
      }
      aggregated[group].append(activity);
    });

    return aggregated;
  };

  // Returns a group to stick this activity in
  getGroup = (activity: Activity): string => '';

  // The ranking logic, for sorting aggregated activities
  rank = (
    aggregated_activities: AggregatedActivity[]
  ): AggregatedActivity[] => [];
}

// Most recently updated aggregated activities are ranked first.
// The ranking logic, for sorting aggregated activities
const recentRank = aggregated_activities => {
  const aggActivities = [...aggregated_activities];
  aggActivities.sort((a, b) => b.updated_at - a.updated_at); // key=lambda a: a.updated_at, reverse=True)

  return aggregated_activities;
};

// Aggregates based on the same verb and same time period
export class RecentVerbAggregator extends BaseAggregator {
  rank = recentRank;

  getGroup = (activity: Activity) => {
    const verb = activity.verb.id;
    const date = activity.time;

    return `${verb}-${date}`;
  };
}

// Aggregates based on the same verb, object and day
export class NotificationAggregator extends BaseAggregator {
  rank = recentRank;

  // Returns a group based on the verb, object and day
  getGroup = (activity: Activity) => {
    const verb = activity.verb.id;
    const object_id = activity.objectId;
    const date = activity.time;

    return `${verb}-${object_id}-${date}`;
  };
}
