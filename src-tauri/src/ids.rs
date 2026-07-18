pub trait IdGenerator {
    fn next_uuid(&self) -> uuid::Uuid;
}

pub struct UuidV7Generator;

impl IdGenerator for UuidV7Generator {
    fn next_uuid(&self) -> uuid::Uuid {
        uuid::Uuid::now_v7()
    }
}

pub fn new_job_id(prefix: &str) -> String {
    new_job_id_with(prefix, &UuidV7Generator)
}

pub fn new_job_id_with(prefix: &str, generator: &impl IdGenerator) -> String {
    format!("{prefix}-{}", generator.next_uuid())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashSet, thread};

    struct FixedIdGenerator;

    impl IdGenerator for FixedIdGenerator {
        fn next_uuid(&self) -> uuid::Uuid {
            uuid::Uuid::from_u128(0x12345678_1234_5678_9abc_def012345678)
        }
    }

    #[test]
    fn deterministic_generators_can_be_injected_in_tests() {
        assert_eq!(
            new_job_id_with("job", &FixedIdGenerator),
            "job-12345678-1234-5678-9abc-def012345678"
        );
    }

    #[test]
    fn concurrent_uuid_job_ids_do_not_collide() {
        let handles = (0..10)
            .map(|_| thread::spawn(|| (0..1_000).map(|_| new_job_id("job")).collect::<Vec<_>>()))
            .collect::<Vec<_>>();
        let ids = handles
            .into_iter()
            .flat_map(|handle| handle.join().expect("id generator thread"))
            .collect::<Vec<_>>();
        let unique = ids.iter().collect::<HashSet<_>>();

        assert_eq!(ids.len(), 10_000);
        assert_eq!(unique.len(), ids.len());
    }
}
