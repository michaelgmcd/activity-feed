import {Activity, AggregatedActivity} from './activity'

// Simple task wrapper for _fanout task
// Just making sure code is where you expect it :)
export const fanout_operation = (feedManager, feedClass, user_ids, operation, operation_kwargs) => {
  feedManager.fanout(user_ids, feedClass, operation, operation_kwargs)

  return `${user_ids.length} user_ids, ${feedClass}, ${operation}, (${operation_kwargs})`;
}



export const fanout_operation_hi_priority = (feedManager, feedClass, user_ids, operation, operation_kwargs) => {
  return fanout_operation(feedManager, feedClass, user_ids, operation, operation_kwargs)
}


export const fanout_operation_low_priority = (feedManager, feedClass, user_ids, operation, operation_kwargs) => {
  return fanout_operation(feedManager, feedClass, user_ids, operation, operation_kwargs)
}


export const follow_many = (feedManager, userId, targetIds, followLimit) => {
  const feeds = feedManager.get_feeds(userId).values()
  const target_feeds = targetIds.map((id) => feedManager.get_user_feed(id))

  const activities = []

  target_feeds.forEach(feed => {
    activities.push(feed[followLimit])
  });

  if (activities) {
    feeds.forEach(feed => {
      const batchInterface = feed.get_timeline_batch_interface();
      feed.add_many(activities, batchInterface)
    });
  }
}


export const unfollow_many = (feedManager, userId, source_ids) => {
  feedManager.get_feeds(userId).forEach(feed => {
    const activities = []
    feed.trim()
    for item in feed[:feed.max_length]:
        if isinstance(item, Activity):
            if item.actor_id in source_ids:
                activities.append(item)
        elif isinstance(item, AggregatedActivity):
            activities.extend(
                [activity for activity in item.activities if activity.actor_id in source_ids])
  
    if activities:
        feed.remove_many(activities)
  
  });
}